import { clean } from "./clean";
import { normalizeName } from "./domain";
import type { Domain, WhoisRecord } from "./types";

export function parseSearch(html: string, name: string, base: string): Domain[] {
  const entries: { domain: string; label: string; id: number | null }[] = [];
  let alert = "";
  let entry: (typeof entries)[number];
  new HTMLRewriter()
    .on("div.alert.alert-danger", { text(chunk) { alert += chunk.text; } })
    .on("div.col-12", {
      element() {
        entry = { domain: "", label: "", id: null };
        entries.push(entry);
      },
    })
    .on("div.col-12 strong", { text(chunk) { entry.domain += chunk.text; } })
    .on("div.col-12 button", {
      element(element) {
        const match = element.getAttribute("onclick")?.match(/^\s*Whois\(\s*(\d+)\s*\)\s*;?\s*$/i);
        if (match) entry.id = Number(match[1]);
      },
      text(chunk) { entry.label += chunk.text; },
    })
    .transform(html);

  if (!entries.length && clean(alert).toLowerCase() === `este nombre de dominio: ${base} es reservado por svnet, no se puede registrar`) {
    throw new Error(`${base} es reservado por SVNet y no se puede registrar.`);
  }
  if (!entries.length) throw new Error("Respuesta de búsqueda no reconocida de SVNet.");
  const results = entries.map(({ domain, label, id }) => {
    domain = clean(domain).toLowerCase();
    label = clean(label).toLowerCase();
    if (normalizeName(domain) !== domain || !domain.endsWith(".sv") ||
        domain.split(".")[0] !== base || !["disponible", "registrado"].includes(label) ||
        (label === "registrado" && (!Number.isSafeInteger(id) || (id ?? 0) < 1))) {
      throw new Error("Respuesta de búsqueda incompleta o no reconocida de SVNet.");
    }
    return label === "disponible"
      ? { domain, status: "available" as const, id: null }
      : { domain, status: "registered" as const, id: id as number };
  });
  const filtered = name.includes(".") ? results.filter((result) => result.domain === name) : results;
  if (!filtered.length) throw new Error(`SVNet no devolvió información para ${name}.`);
  return filtered;
}

export function parseWhois(html: string, id: number, expectedDomain?: string): WhoisRecord {
  const rows: { text: string }[][] = [];
  let row: (typeof rows)[number];
  let cell: (typeof row)[number];
  new HTMLRewriter()
    .on("table tr", { element() { row = []; rows.push(row); } })
    .on("table tr td", {
      element() { cell = { text: "" }; row.push(cell); },
      text(chunk) { cell.text += chunk.text; },
    })
    .transform(html);
  const fields = Object.fromEntries(rows.filter((row) => row.length === 2).map(([label, value]) => [
    clean(label.text).replace(/:$/, "").toLowerCase(), clean(value.text),
  ]));
  const domain = fields["nombre de dominio"]?.toLowerCase();
  if (!domain || normalizeName(domain) !== domain || !domain.endsWith(".sv") ||
      fields.estado?.toLowerCase() !== "registrado" || (expectedDomain && domain !== expectedDomain)) {
    throw new Error("Respuesta WHOIS incompleta o no reconocida de SVNet.");
  }
  return {
    domain,
    status: "registered",
    id,
    administrativeContact: fields["contacto administrativo"] || null,
    email: fields["correo electrónico"] || null,
    phone: fields["teléfono"] || null,
    registeredAt: fields["fecha registro"] || null,
    expiresAt: fields["fecha de vencimiento"] || null,
    deletionAt: fields["fecha de baja"] || null,
  };
}
