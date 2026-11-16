import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const dataDir = process.env.SVNET_DATA_DIR || join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "svnet");
mkdirSync(dataDir, { recursive: true });
export const db = new Database(join(dataDir, "dominios.sqlite"), { create: true });
db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
db.exec(`CREATE TABLE IF NOT EXISTS domains (
  palabra TEXT NOT NULL, dominio TEXT NOT NULL, estado TEXT NOT NULL, id INTEGER, indexado_en TEXT
);
CREATE INDEX IF NOT EXISTS domains_word ON domains(palabra);
CREATE TABLE IF NOT EXISTS featured (type TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (type, value));
CREATE TABLE IF NOT EXISTS sync (id INTEGER PRIMARY KEY CHECK (id=1), pid INTEGER, state TEXT, word TEXT, error TEXT, started TEXT, finished TEXT);
CREATE TABLE IF NOT EXISTS sync_words (word TEXT PRIMARY KEY, position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sync_list (id INTEGER PRIMARY KEY CHECK (id=1), source TEXT NOT NULL);
INSERT OR IGNORE INTO sync (id, state) VALUES (1, 'idle');`);

export type Row = { palabra: string; dominio: string; estado: string; id: number | null; indexado_en: string | null };
export const extensions = [".com.sv", ".org.sv", ".edu.sv", ".gob.sv", ".sv"];
export function complete(word: string, rows: Row[]) {
  if (rows.some(row => row.dominio === word && row.estado === "reserved")) return true;
  return extensions.every(ext => rows.some(row => row.dominio === word + ext && ["available", "registered", "unknown"].includes(row.estado)));
}
export function rowsFor(word: string) {
  return db.query<Row, [string]>("SELECT * FROM domains WHERE palabra = ? ORDER BY rowid").all(word);
}
db.transaction(() => {
  const exists = db.query("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sync_done'").get();
  if (exists) return;
  db.exec("CREATE TABLE sync_done (word TEXT PRIMARY KEY)");
  const insert = db.query("INSERT INTO sync_done VALUES (?)");
  for (const { word } of db.query<{ word: string }, []>("SELECT word FROM sync_words").all()) {
    if (complete(word, rowsFor(word))) insert.run(word);
  }
}).immediate();
export const save = db.transaction((word: string, rows: Row[], refresh = false) => {
  const existing = rowsFor(word);
  if (!refresh && complete(word, existing)) return false;
  if (refresh || existing.length) db.query("DELETE FROM domains WHERE palabra = ?").run(word);
  const insert = db.query("INSERT INTO domains VALUES (?, ?, ?, ?, ?)");
  for (const row of rows) insert.run(row.palabra, row.dominio, row.estado, row.id, row.indexado_en);
  return true;
});

export function groupRows(rows: Row[]) {
  const groups = new Map<string, Row[]>();
  for (const row of rows) groups.set(row.palabra, [...(groups.get(row.palabra) || []), row]);
  return [...groups].map(([palabra, entries]) => {
    const reserved = entries.some(row => row.estado === "reserved" && row.dominio === palabra);
    const domains = extensions.map(extension => {
      const dominio = palabra + extension;
      const states = new Set(entries.filter(row => row.dominio === dominio).map(row => row.estado));
      return { dominio, estado: reserved && (states.size === 0 || (states.size === 1 && states.has("unknown"))) ? "reserved" : states.size === 0 ? "unknown" : states.size > 1 ? "mixed" : [...states][0] };
    });
    const states = new Set(domains.map(row => row.estado));
    const estado = states.has("mixed") || (states.has("available") && (reserved || states.has("registered"))) ? "mixed" : reserved ? "unavailable" :
      states.has("unknown") || states.size !== 1 ? "unknown" : states.has("available") ? "available" : "unavailable";
    const indexado_en = entries.every(row => row.indexado_en) ? entries.map(row => row.indexado_en!).sort().at(-1) : null;
    return { palabra, estado, reservado: reserved, sv: domains[4].estado, indexado_en, domains };
  });
}
