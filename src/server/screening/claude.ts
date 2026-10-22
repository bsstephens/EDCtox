import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

import type { SuggestionProvider } from "./applySuggestions";
import { REPRODUCTIVE_ENDPOINTS, type ScreeningText } from "./deterministic";
import {
  CLAUDE_SCREENING_PROMPT_VERSION,
  SCREENING_OUTPUT_SCHEMA,
  ScreeningProviderError,
  buildScreeningSystemPrompt,
  buildScreeningUserPrompt,
  parseScreeningOutput,
} from "./prompt";

export { CLAUDE_SCREENING_PROMPT_VERSION };

/// Haiku 5.5 is the screening model in the phase 4 design: a bounded classification into the
/// existing enums at high volume. The model id is recorded on every CurationAgentRun.
export const CLAUDE_SCREENING_MODEL = "claude-haiku-5-5";
export const CLAUDE_SCREENING_PROVIDER = "anthropic";

export type ScreeningCompletionRequest = {
  model: string;
  system: string;
  user: string;
  schema: typeof SCREENING_OUTPUT_SCHEMA;
};

export type ScreeningCompletion = {
  output: unknown;
  /// The model that actually served the request, when the transport reports it.
  servedModel: string | null;
};

/// A transport carries one prompt to Claude and brings back the structured output. The provider
/// code is the same whichever transport runs it; moving between the Claude Code session, a
/// scheduled task and the API is a configuration change.
export type ScreeningTransport = {
  name: string;
  complete: (request: ScreeningCompletionRequest) => Promise<ScreeningCompletion>;
};

export function loadSeedKnowledge(compoundSlug: string): string {
  const path = new URL(`../../../docs/seed-knowledge/${compoundSlug}.md`, import.meta.url);
  try {
    return readFileSync(path, "utf8");
  } catch {
    throw new ScreeningProviderError(`No seed-knowledge file for ${compoundSlug}. Expected docs/seed-knowledge/${compoundSlug}.md.`);
  }
}

/// The Messages API through the official SDK. Credentials come from the environment
/// (ANTHROPIC_API_KEY or an `ant auth login` profile). Structured output is enforced by the API.
export function anthropicTransport(client: Anthropic = new Anthropic()): ScreeningTransport {
  return {
    name: "anthropic-api",
    complete: async (request) => {
      const message = await client.messages.parse({
        model: request.model,
        max_tokens: 1024,
        system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: request.user }],
        output_config: { effort: "low", format: jsonSchemaOutputFormat(request.schema) },
      });
      if (message.stop_reason === "refusal") {
        throw new ScreeningProviderError("The model declined to screen this publication.");
      }
      if (message.stop_reason === "max_tokens") {
        throw new ScreeningProviderError("The model ran out of output tokens before finishing the suggestion.");
      }
      if (!message.parsed_output) {
        throw new ScreeningProviderError("The model returned no structured output.");
      }
      return { output: message.parsed_output, servedModel: message.model };
    },
  };
}

type ClaudeCodeResult = {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  structured_output?: unknown;
  modelUsage?: Record<string, unknown>;
};

function runClaudeCode(binary: string, args: string[], stdin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["pipe", "pipe", "pipe"], env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error) => reject(new ScreeningProviderError(`Could not start ${binary}: ${error.message}`)));
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new ScreeningProviderError(`${binary} exited with ${code}: ${stderr.trim() || stdout.trim().slice(0, 400)}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin.end(stdin);
  });
}

/// The Claude Code CLI in print mode, which is how a cloud session or a scheduled cloud task
/// does the model work under the Max subscription. The prompt is passed on stdin, the schema
/// with --json-schema, and no tools are offered, so the call is a single bounded completion.
export function claudeCodeTransport(options: { binary?: string } = {}): ScreeningTransport {
  const binary = options.binary ?? process.env.CLAUDE_CODE_BIN ?? "claude";
  return {
    name: "claude-code",
    complete: async (request) => {
      const stdout = await runClaudeCode(
        binary,
        [
          "-p",
          "--model",
          request.model,
          "--output-format",
          "json",
          "--no-session-persistence",
          "--tools",
          "",
          "--system-prompt",
          request.system,
          "--json-schema",
          JSON.stringify(request.schema),
        ],
        request.user,
      );
      let result: ClaudeCodeResult;
      try {
        result = JSON.parse(stdout) as ClaudeCodeResult;
      } catch {
        throw new ScreeningProviderError(`${binary} did not return JSON: ${stdout.slice(0, 200)}`);
      }
      if (result.is_error || result.subtype !== "success") {
        throw new ScreeningProviderError(`${binary} failed: ${result.result ?? result.subtype ?? "unknown error"}`);
      }
      if (result.structured_output === undefined) {
        throw new ScreeningProviderError(`${binary} returned no structured output.`);
      }
      const served = Object.keys(result.modelUsage ?? {});
      return { output: result.structured_output, servedModel: served.length === 1 ? (served[0] ?? null) : null };
    },
  };
}

/// Picks the transport from the environment: the API when a key is present or the variable asks
/// for it, otherwise the Claude Code CLI.
export function chooseScreeningTransport(env: NodeJS.ProcessEnv = process.env): ScreeningTransport {
  const requested = env.EDCTOX_SCREENING_TRANSPORT;
  if (requested === "anthropic") return anthropicTransport();
  if (requested === "claude-code") return claudeCodeTransport();
  if (requested) throw new ScreeningProviderError(`Unknown EDCTOX_SCREENING_TRANSPORT ${requested}. Use anthropic or claude-code.`);
  return env.ANTHROPIC_API_KEY ? anthropicTransport() : claudeCodeTransport();
}

export type ClaudeScreenerOptions = {
  transport: ScreeningTransport;
  seedKnowledge: string;
  model?: string;
  endpointVocabulary?: readonly string[];
  /// Called after every completion with the model the transport reports. Used by the dry run.
  onServedModel?: (model: string | null) => void;
};

/// The Claude-backed SuggestionProvider. Same MachineSuggestion shape as the deterministic rules:
/// decision, reason code, confidence, one-paragraph rationale, governing purpose. The system prompt
/// is built once so it is byte-stable across the batch and the API can cache it.
export function suggestWithClaude(options: ClaudeScreenerOptions): SuggestionProvider {
  const system = buildScreeningSystemPrompt({
    seedKnowledge: options.seedKnowledge,
    endpointVocabulary: options.endpointVocabulary ?? REPRODUCTIVE_ENDPOINTS,
  });
  const model = options.model ?? CLAUDE_SCREENING_MODEL;
  return async (candidate: ScreeningText) => {
    const completion = await options.transport.complete({
      model,
      system,
      user: buildScreeningUserPrompt(candidate),
      schema: SCREENING_OUTPUT_SCHEMA,
    });
    options.onServedModel?.(completion.servedModel);
    return parseScreeningOutput(completion.output, candidate.purposes);
  };
}
