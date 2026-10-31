import { decodeHTML } from "entities/decode";

const ENDPOINT = "https://svnet.sv/accion/procesos.php";
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

function normalizeName(value) {
  if (typeof value !== "string") throw new Error("Escribe un nombre o dominio .sv.");
  const name = value.trim().toLowerCase().replace(/\.$/, "");
  const parts = name.split(".");
  if (!parts.every((part) => LABEL.test(part)) || parts.length > 3 ||
      (parts.length > 1 && parts.at(-1) !== "sv")) {
    throw new Error("Nombre inválido: usa mi, mi.sv o mi.com.sv (sin URL ni subdominios).");
  }
  return name;
}

function clean(text) {
  return decodeHTML(text).replace(/\s+/g, " ").replace(/[\x00-\x1f\x7f-\x9f]/g, "").trim();
}

async function post(params, { timeout = 15000, fetch: fetcher = globalThis.fetch } = {}) {
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 2147483647) {
    throw new Error("El timeout debe ser un entero entre 1 y 2147483647 milisegundos.");
  }
  try {
    const response = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { Accept: "text/html" },
      body: new URLSearchParams(params),
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) throw new Error(`SVNet respondió HTTP ${response.status}.`);
    return await response.text();
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error(`SVNet no respondió en ${timeout} ms.`, { cause: error });
    }
    throw new Error(`No se pudo consultar SVNet: ${error.message}`, { cause: error });
  }
}

/** Busca un nombre en todas las extensiones; un dominio completo filtra el resultado. */
export async function search(value, options) {
  const name = normalizeName(value);
  const base = name.split(".")[0];
  const html = await post({ key: "Buscar", ID: "1", nombre: base }, options);
  const entries = [];
  let alert = "";
  let entry;
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
        (label === "registrado" && (!Number.isSafeInteger(id) || id < 1))) {
      throw new Error("Respuesta de búsqueda incompleta o no reconocida de SVNet.");
    }
    return { domain, status: label === "disponible" ? "available" : "registered", id };
  });
  const filtered = name.includes(".") ? results.filter((result) => result.domain === name) : results;
  if (!filtered.length) throw new Error(`SVNet no devolvió información para ${name}.`);
  return filtered;
}

/** Consulta WHOIS por dominio o ID de SVNet. Un nombre sin extensión usa .sv. */
export async function whois(value, options) {
  let expectedDomain;
  let id = value;
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
  const rows = [];
  let row;
  let cell;
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
