#!/usr/bin/env bash
# Aplica as migrações de drizzle/ no banco D1 local usado pelo `npm run dev`.
# Em produção a plataforma aplica as mesmas migrações automaticamente.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec bash "${script_dir}/sites-env.sh" -- bash "$0" "$@"
fi

config_dir="${SITES_PROJECT_ROOT}/.wrangler/local-d1"
mkdir -p "${config_dir}"

# Mesmo nome e id que vite.config.ts usa para simular o binding localmente.
cat >"${config_dir}/wrangler.json" <<JSON
{
  "name": "site",
  "compatibility_date": "2026-01-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "site-creator-d1",
      "database_id": "00000000-0000-4000-8000-000000000000",
      "migrations_dir": "${SITES_PROJECT_ROOT}/drizzle"
    }
  ]
}
JSON

"${SITES_PROJECT_ROOT}/node_modules/.bin/wrangler" d1 migrations apply site-creator-d1 \
  --local \
  --config "${config_dir}/wrangler.json" \
  --persist-to "${SITES_PROJECT_ROOT}/.wrangler/state"
