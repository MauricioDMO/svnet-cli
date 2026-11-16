import { search } from "../index";
import { extensions, save, type Row } from "../storage/store";

async function fetchEntries(word: string) {
  let entries: { domain: string; status: string; id: number | null }[];
  try {
    entries = await search(word, { timeout: 30000 });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== `${word} es reservado por SVNet y no se puede registrar.`) throw error;
    entries = [{ domain: word, status: "reserved", id: null }];
  }
  return entries;
}

function completeEntries(word: string, entries: { domain: string; status: string; id: number | null }[]) {
  if (entries[0]?.status === "reserved") return entries;
  const expected = extensions.map(ext => word + ext);
  if (!entries.length || entries.some(entry => !expected.includes(entry.domain) || !["available", "registered"].includes(entry.status))) {
    throw new Error("Respuesta inesperada de SVNet.");
  }
  for (const domain of expected) if (!entries.some(entry => entry.domain === domain)) entries.push({ domain, status: "unknown", id: null });
  return entries;
}

export async function collect(word: string, refresh = false) {
  const entries = completeEntries(word, await fetchEntries(word));
  const timestamp = new Date().toISOString();
  const rows: Row[] = entries.map(entry => ({ palabra: word, dominio: entry.domain, estado: entry.status, id: entry.id, indexado_en: timestamp }));
  return { added: save(word, rows, refresh), word, reserved: entries[0].status === "reserved" };
}
