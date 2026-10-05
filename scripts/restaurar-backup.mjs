#!/usr/bin/env node
// Restaura uma cópia de segurança do Recebi.
//
// 1. Baixe a cópia no painel de administração (arquivo recebi-backup-AAAA-MM-DD.json.enc).
// 2. Gere o SQL (a chave é a mesma RECEBI_ENCRYPTION_KEY do site; guarde-a com cuidado):
//      RECEBI_ENCRYPTION_KEY='...' node scripts/restaurar-backup.mjs recebi-backup-AAAA-MM-DD.json.enc > restaurar.sql
// 3. Confira o arquivo e aplique no banco D1 (APAGA os dados atuais das tabelas da cópia):
//      npx wrangler d1 execute NOME_DO_BANCO --remote --file restaurar.sql
// O arquivo restaurar.sql tem os dados abertos: apague depois de usar (ele já está no .gitignore).
import { readFileSync } from "node:fs";
import { decryptWith } from "../lib/recebi/encryption-core.ts";

const CONTEXT = "recebi-backup";

function quote(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/g, "''")}'`;
}

const file = process.argv[2];
const key = process.env.RECEBI_ENCRYPTION_KEY;
if (!file || !key) {
  console.error("Uso: RECEBI_ENCRYPTION_KEY='...' node scripts/restaurar-backup.mjs arquivo.json.enc > restaurar.sql");
  process.exit(1);
}

const json = await decryptWith([key, process.env.RECEBI_ENCRYPTION_KEY_OLD], readFileSync(file, "utf8").trim(), CONTEXT);
if (!json) {
  console.error("Não foi possível abrir a cópia: confira se a chave é a mesma usada pelo site quando a cópia foi feita.");
  process.exit(1);
}
const backup = JSON.parse(json);
if (backup.app !== "recebi" || backup.version !== 1) {
  console.error("Este arquivo não é uma cópia de segurança do Recebi.");
  process.exit(1);
}

const out = [`-- Cópia de segurança do Recebi de ${backup.day} (feita em ${backup.createdAt})`, "PRAGMA defer_foreign_keys = true;"];
for (const [table, rows] of Object.entries(backup.tables)) {
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) continue;
  out.push(`DELETE FROM "${table}";`);
  for (const row of rows) {
    const columns = Object.keys(row).filter((column) => /^[a-z_][a-z0-9_]*$/.test(column));
    out.push(
      `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${columns.map((c) => quote(row[c])).join(", ")});`,
    );
  }
}
process.stdout.write(`${out.join("\n")}\n`);
console.error(`OK: ${Object.keys(backup.tables).length} tabelas da cópia de ${backup.day}.`);
