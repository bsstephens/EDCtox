#!/usr/bin/env python3
"""Export Cursor chat / Composer / Agent history to Markdown (macOS).

Read-only. Copies Cursor's SQLite files to a temp dir first, so it is safe to
run while Cursor is open.

Usage:
    python3 cursor_export.py                       # every workspace
    python3 cursor_export.py --workspace EDCtox    # only workspaces whose folder path contains "EDCtox"
    python3 cursor_export.py --out ~/Desktop/cursor-chats

Output: one .md file per conversation under <out>/<workspace-folder-name>/.
"""
import argparse
import json
import re
import shutil
import sqlite3
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

BASE = Path.home() / "Library/Application Support/Cursor/User"
GLOBAL_DB = BASE / "globalStorage/state.vscdb"
WORKSPACES = BASE / "workspaceStorage"


def open_ro(path: Path) -> sqlite3.Connection:
    tmp_dir = Path(tempfile.mkdtemp(prefix="cursor-export-"))
    dest = tmp_dir / path.name
    shutil.copy2(path, dest)
    for suffix in ("-wal", "-shm"):
        side = path.with_name(path.name + suffix)
        if side.exists():
            shutil.copy2(side, dest.with_name(dest.name + suffix))
    return sqlite3.connect(f"file:{dest}?mode=ro", uri=True)


def kv_get(conn: sqlite3.Connection, table: str, key: str):
    try:
        row = conn.execute(f"SELECT value FROM {table} WHERE key = ?", (key,)).fetchone()
    except sqlite3.OperationalError:
        return None
    if not row or row[0] is None:
        return None
    raw = row[0]
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="replace")
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def kv_like(conn: sqlite3.Connection, table: str, prefix: str):
    try:
        rows = conn.execute(f"SELECT key, value FROM {table} WHERE key LIKE ?", (prefix + "%",)).fetchall()
    except sqlite3.OperationalError:
        return []
    out = []
    for key, raw in rows:
        if raw is None:
            continue
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", errors="replace")
        try:
            out.append((key, json.loads(raw)))
        except json.JSONDecodeError:
            pass
    return out


def ts(ms):
    if not ms:
        return ""
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M")
    except (ValueError, OSError, TypeError):
        return ""


def slug(text: str, n: int = 60) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "-", text or "").strip("-").lower()
    return (s[:n] or "untitled").rstrip("-")


def bubble_text(b: dict) -> str:
    parts = []
    text = b.get("text") or b.get("rawText") or ""
    if text.strip():
        parts.append(text.strip())
    tool = b.get("toolFormerData")
    if isinstance(tool, dict) and tool.get("name"):
        params = tool.get("params") or tool.get("rawArgs") or ""
        if isinstance(params, (dict, list)):
            params = json.dumps(params)[:400]
        parts.append(f"> [tool: {tool['name']}] {str(params)[:400]}")
    for cb in b.get("codeBlocks") or []:
        code = cb.get("content") or cb.get("code")
        if code:
            lang = cb.get("languageId") or ""
            parts.append(f"```{lang}\n{code}\n```")
    return "\n\n".join(parts)


def role_of(b: dict) -> str:
    t = b.get("type")
    if t in (1, "user"):
        return "User"
    if t in (2, "ai", "assistant"):
        return "Assistant"
    return f"Type {t}"


def composer_bubbles(global_conn, ws_conn, composer_id: str, data: dict):
    # Older builds: bubbles inline. Newer builds: headers + one row per bubble.
    if isinstance(data.get("conversation"), list) and data["conversation"]:
        return data["conversation"]
    headers = data.get("fullConversationHeadersOnly") or []
    bubbles = []
    for h in headers:
        bid = h.get("bubbleId")
        if not bid:
            continue
        key = f"bubbleId:{composer_id}:{bid}"
        b = kv_get(global_conn, "cursorDiskKV", key)
        if b is None and ws_conn is not None:
            b = kv_get(ws_conn, "cursorDiskKV", key)
        if b is None:
            b = {"type": h.get("type"), "text": "(bubble missing from store)"}
        bubbles.append(b)
    return bubbles


def write_md(path: Path, title: str, meta: dict, bubbles: list):
    lines = [f"# {title}", ""]
    for k, v in meta.items():
        if v:
            lines.append(f"- **{k}:** {v}")
    lines.append("")
    for b in bubbles:
        body = bubble_text(b)
        if not body:
            continue
        lines.append(f"## {role_of(b)}")
        lines.append("")
        lines.append(body)
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(Path.home() / "Desktop/cursor-chats"))
    ap.add_argument("--workspace", default="", help="substring of the workspace folder path, e.g. EDCtox")
    args = ap.parse_args()

    if not GLOBAL_DB.exists():
        sys.exit(f"Cursor global store not found at {GLOBAL_DB}")
    out_root = Path(args.out).expanduser()
    global_conn = open_ro(GLOBAL_DB)

    # Every composerData row in the global store, keyed by id.
    global_composers = {k.split(":", 1)[1]: v for k, v in kv_like(global_conn, "cursorDiskKV", "composerData:")}

    exported = 0
    seen_ids = set()
    for ws_dir in sorted(WORKSPACES.glob("*")):
        ws_json = ws_dir / "workspace.json"
        db = ws_dir / "state.vscdb"
        if not db.exists():
            continue
        folder = ""
        if ws_json.exists():
            try:
                folder = json.loads(ws_json.read_text()).get("folder", "")
            except json.JSONDecodeError:
                pass
        folder_path = folder.replace("file://", "")
        if args.workspace and args.workspace.lower() not in folder_path.lower():
            continue
        ws_name = Path(folder_path).name or ws_dir.name
        ws_conn = open_ro(db)
        out_dir = out_root / slug(ws_name, 40)

        # Composer / Agent sessions listed by this workspace.
        listing = kv_get(ws_conn, "ItemTable", "composer.composerData") or {}
        for c in listing.get("allComposers") or []:
            cid = c.get("composerId")
            if not cid or cid in seen_ids:
                continue
            data = global_composers.get(cid) or kv_get(ws_conn, "cursorDiskKV", f"composerData:{cid}")
            if not data:
                continue
            seen_ids.add(cid)
            bubbles = composer_bubbles(global_conn, ws_conn, cid, data)
            if not bubbles:
                continue
            name = c.get("name") or data.get("name") or "untitled"
            created = c.get("createdAt") or data.get("createdAt")
            out_dir.mkdir(parents=True, exist_ok=True)
            fname = f"{(ts(created) or '0000')[:10]}-{slug(name)}-{cid[:8]}.md"
            write_md(out_dir / fname, name, {
                "Workspace": folder_path,
                "Created": ts(created),
                "Last updated": ts(c.get("lastUpdatedAt") or data.get("lastUpdatedAt")),
                "Composer id": cid,
            }, bubbles)
            exported += 1

        # Legacy chat panel tabs (older Cursor builds).
        legacy = kv_get(ws_conn, "ItemTable", "workbench.panel.aichat.view.aichat.chatdata") or {}
        for tab in legacy.get("tabs") or []:
            bubbles = tab.get("bubbles") or []
            if not bubbles:
                continue
            title = tab.get("chatTitle") or "chat"
            out_dir.mkdir(parents=True, exist_ok=True)
            fname = f"{(ts(tab.get('lastSendTime')) or '0000')[:10]}-legacy-{slug(title)}-{str(tab.get('tabId', ''))[:8]}.md"
            write_md(out_dir / fname, title, {"Workspace": folder_path, "Last sent": ts(tab.get("lastSendTime"))}, bubbles)
            exported += 1
        ws_conn.close()

    # Composers that no workspace lists (orphaned or global-only).
    if not args.workspace:
        out_dir = out_root / "_unlisted"
        for cid, data in global_composers.items():
            if cid in seen_ids:
                continue
            bubbles = composer_bubbles(global_conn, None, cid, data)
            if not bubbles:
                continue
            name = data.get("name") or "untitled"
            out_dir.mkdir(parents=True, exist_ok=True)
            fname = f"{(ts(data.get('createdAt')) or '0000')[:10]}-{slug(name)}-{cid[:8]}.md"
            write_md(out_dir / fname, name, {"Created": ts(data.get("createdAt")), "Composer id": cid}, bubbles)
            exported += 1

    global_conn.close()
    print(f"Exported {exported} conversation(s) to {out_root}")


if __name__ == "__main__":
    main()
