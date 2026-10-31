import { normalizeName } from "./domain";
import { parseSearch, parseWhois } from "./parser";
import { post } from "./request";
import type { Domain, RequestOptions, WhoisRecord } from "./types";

export type { Domain, RequestOptions, WhoisRecord } from "./types";

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
    const [result] = await search(expectedDomain, options);
    if (result.status === "available") return result;
    id = result.id;
  }
  id = Number(id);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("El ID de WHOIS debe ser un entero positivo seguro.");
  const html = await post({ key: "Whois", ID: String(id) }, options);
  return parseWhois(html, id, expectedDomain);
}
