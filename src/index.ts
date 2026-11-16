import { normalizeName } from "./svnet/domain";
import { parseSearch, parseWhois } from "./svnet/parser";
import { post } from "./svnet/request";
import type { Domain, RequestOptions, WhoisRecord } from "./svnet/types";

export type { Domain, RequestOptions, WhoisRecord } from "./svnet/types";

/** Busca un nombre en todas las extensiones; un dominio completo filtra el resultado. */
export async function search(value: string, options?: RequestOptions): Promise<Domain[]> {
  const name = normalizeName(value);
  const base = name.split(".")[0];
  const html = await post({ key: "Buscar", ID: "1", nombre: base }, options);
  return parseSearch(html, name, base);
}

/** Consulta WHOIS por dominio o ID de SVNet. Un nombre sin extensión usa .sv. */
export async function whois(value: string | number, options?: RequestOptions): Promise<Domain | WhoisRecord> {
  let expectedDomain: string | undefined;
  let id: string | number = value;
  if (typeof value !== "number" && !(typeof value === "string" && /^\d+$/.test(value))) {
    const name = normalizeName(value);
    expectedDomain = name.includes(".") ? name : `${name}.sv`;
    const results = await search(expectedDomain, options);
    const registered = results.filter(result => result.status === "registered");
    if (!registered.length) return results[0];
    const ids = registered.map(result => result.id).filter((id): id is number => id !== null);
    if (new Set(ids).size > 1) {
      throw new Error(`SVNet devolvió múltiples IDs de registro para ${expectedDomain}.`);
    }
    if (!ids.length) return registered[0];
    id = ids[0];
  }
  id = Number(id);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("El ID de WHOIS debe ser un entero positivo seguro.");
  const html = await post({ key: "Whois", ID: String(id) }, options);
  return parseWhois(html, id, expectedDomain);
}
