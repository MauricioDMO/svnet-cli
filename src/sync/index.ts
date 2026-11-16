import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import wordsText from "./es-5000.txt" with { type: "text" };
import { collect } from "../explorer/collector";
import { complete, db, groupRows, rowsFor, save, type Row } from "../storage/store";

function parseWords(text: string) {
  const words = text.replace(/^\uFEFF/, "").split(/\r?\n/).map(word => word.trim().toLowerCase()).filter(Boolean);
  const invalid = words.find(word => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(word));
  if (invalid) throw new Error(`Palabra inválida en el archivo: ${invalid}`);
  if (!words.length) throw new Error("El archivo de palabras está vacío.");
  return [...new Set(words)];
}
const defaultWords = parseWords(wordsText);
type Sync = { pid: number | null; state: string; word: string | null; error: string | null; started: string | null; finished: string | null };
function alive(pid: number | null) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code === "EPERM"; }
}
export function status() {
  const sync = db.query<Sync, []>("SELECT pid, state, word, error, started, finished FROM sync WHERE id=1").get()!;
  const running = sync.state === "running" && alive(sync.pid);
  const list = db.query<{ source: string }, []>("SELECT source FROM sync_list WHERE id=1").get();
  const words = list ? db.query<{ word: string }, []>("SELECT word FROM sync_words ORDER BY position").all().map(row => row.word) : defaultWords;
  const done = words.filter(word => complete(word, rowsFor(word))).length;
  return { ...sync, state: sync.state === "running" && !running ? "interrupted" : sync.state, running, source: list?.source || "lista incluida", completed: done, total: words.length, remaining: words.length - done };
}
const claim = db.transaction((words: string[], source: string) => {
  const current = db.query<Sync, []>("SELECT * FROM sync WHERE id=1").get()!;
  if (current.state === "running" && alive(current.pid)) return false;
  db.exec("DELETE FROM sync_words");
  const insert = db.query("INSERT INTO sync_words (word, position) VALUES (?, ?)");
  words.forEach((word, index) => insert.run(word, index));
  db.query("INSERT OR REPLACE INTO sync_list (id, source) VALUES (1, ?)").run(source);
  db.query("UPDATE sync SET pid=?, state='running', word=NULL, error=NULL, started=?, finished=NULL WHERE id=1").run(process.pid, new Date().toISOString());
  return true;
});
export async function worker() {
  const { words, source } = JSON.parse(await Bun.stdin.text()) as { words: string[]; source: string };
  if (!claim.immediate(words, source)) {
    console.log("busy");
    return;
  }
  console.log("started");
  try {
    for (const word of words) {
      if (complete(word, rowsFor(word))) continue;
      db.query("UPDATE sync SET word=? WHERE id=1").run(word);
      await collect(word);
    }
    db.query("UPDATE sync SET state='completed', finished=? WHERE id=1").run(new Date().toISOString());
  } catch (error) {
    db.query("UPDATE sync SET state='error', error=?, finished=? WHERE id=1").run(error instanceof Error ? error.message : String(error), new Date().toISOString());
  }
}
export async function start(path?: string) {
  const current = status();
  if (current.running) return current;
  const source = path ? resolve(path) : "lista incluida";
  const words = path ? parseWords(readFileSync(source, "utf8")) : defaultWords;
  const args = Bun.main.startsWith("/$bunfs/") ? ["sync", "_worker"] : [Bun.main, "sync", "_worker"];
  const child = spawn(process.execPath, args, { detached: true, stdio: ["pipe", "pipe", "ignore"], env: process.env });
  child.stdin!.end(JSON.stringify({ words, source }));
  const response = await new Promise<string>((resolve, reject) => {
    child.once("error", reject);
    child.stdout!.once("data", chunk => resolve(String(chunk).trim()));
    child.once("exit", code => reject(new Error(`No se pudo iniciar sync (código ${code}).`)));
  });
  child.stdout!.destroy();
  child.unref();
  if (response !== "started" && response !== "busy") throw new Error("No se pudo iniciar la sincronización.");
  return status();
}

export function importCsv(path: string) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  const header = lines.shift();
  if (header !== "palabra,dominio,estado,id,indexado_en" && header !== "palabra,dominio,estado,id") throw new Error("Formato CSV inválido.");
  const rows: Row[] = lines.filter(Boolean).map(line => {
    const fields = line.split(",");
    const [palabra, dominio, estado, id, indexado_en] = fields;
    if (fields.length !== header.split(",").length || !/^[a-z0-9-]+$/.test(palabra) ||
      !/^[a-z0-9.-]+$/.test(dominio) || !["available", "registered", "unknown", "reserved"].includes(estado) ||
      (id && !/^\d+$/.test(id))) throw new Error("Fila CSV inválida; no se importó ningún dato.");
    return { palabra, dominio, estado, id: id ? Number(id) : null, indexado_en: indexado_en || null };
  });
  const groups = new Map<string, Row[]>();
  for (const row of rows) groups.set(row.palabra, [...(groups.get(row.palabra) || []), row]);
  return db.transaction(() => {
    let imported = 0;
    for (const [word, entries] of groups) {
      if (rowsFor(word).length) continue;
      // Preserve historical contradictory and incomplete rows as they were recorded.
      if (save(word, entries)) imported++;
    }
    return { imported, groups: groupRows(rows).length };
  }).immediate();
}
