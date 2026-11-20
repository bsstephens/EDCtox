#!/usr/bin/env bash
# Seed the hosted database from this machine.
#
# Put the hosted connection strings in .env.supabase.local (gitignored):
#   DATABASE_URL="postgresql://...:6543/postgres?pgbouncer=true&sslmode=require"
#   DIRECT_URL="postgresql://...:5432/postgres?sslmode=require"
# The seed runs over DIRECT_URL, the session pooler, because a bulk write through the
# transaction pooler is not reliable for Prisma. DIRECT_URL falls back to DATABASE_URL.
#
# Run from anywhere:
#   ./scripts/seed-production.sh
#
# This writes the seed hypotheses. Run it once on an empty production
# database. A later run overwrites seeded scores on the same assessment keys.

set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [[ -z "${DATABASE_URL:-}" ]]; then
  for env_file in "$root/.env.supabase.local" "$root/.env.production.local"; do
    if [[ -f "$env_file" ]]; then
      set -a
      # shellcheck disable=SC1090
      source "$env_file"
      set +a
      break
    fi
  done
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "No DATABASE_URL. Add it to .env.supabase.local, or export it for this command."
  echo "That file is gitignored. Do not commit the URL."
  exit 1
fi

export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"
# Write through the session pooler, and read through it too for the duration of the seed.
export DATABASE_URL="$DIRECT_URL"

host="$(node -e 'const u = new URL(process.env.DATABASE_URL); console.log(u.host)')"

case "$DATABASE_URL" in
  *localhost*|*127.0.0.1*)
    echo "Refusing to seed a local database ($host)."
    exit 1
    ;;
esac

echo "Production seed target: $host"
echo "Matching seeded assessment keys will be written back to the seed values."
printf "Type seed to continue: "
read -r answer
if [[ "$answer" != "seed" ]]; then
  echo "Stopped."
  exit 1
fi

exec env DATABASE_URL="$DATABASE_URL" DIRECT_URL="$DIRECT_URL" \
  "$root/node_modules/.bin/tsx" "$root/prisma/seed.ts"
