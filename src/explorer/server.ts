import html from "./explorer.html" with { type: "text" };
import { whois } from "../index";
import { collect } from "./collector";
import { db, extensions, groupRows, type Row } from "../storage/store";

const domainPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.(?:(?:com|org|edu|gob)\.)?sv$/;
async function handleConsult(request: Request, url: URL) {
      if (request.headers.get("origin") !== url.origin || !request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Solicitud no autorizada." }, { status: 403 });
      let input;
      try { input = await request.json(); } catch { return Response.json({ error: "Solicitud inválida." }, { status: 400 }); }
      const value = typeof input?.word === "string" ? input.word.trim().toLowerCase() : "";
      const word = value.replace(/\.(?:(?:com|org|edu|gob)\.)?sv$/, "");
      if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(word)) return Response.json({ error: "Escribe una palabra o un dominio .sv válido." }, { status: 400 });
      try { return Response.json(await collect(word, input.refresh === true)); }
      catch (error) { return Response.json({ error: error instanceof Error ? error.message : "No se pudo consultar SVNet." }, { status: 502 }); }
}

async function handleWhois(url: URL) {
      const domain = url.searchParams.get("domain") || "";
      if (!domainPattern.test(domain)) return Response.json({ error: "Dominio .sv inválido." }, { status: 400 });
      try { return Response.json(await whois(domain, { timeout: 30000 })); }
      catch (error) { return Response.json({ error: error instanceof Error ? error.message : "No se pudo consultar el dominio." }, { status: 502 }); }
}

function handleDomains(url: URL) {
      const query = (url.searchParams.get("q") || "").trim().toLowerCase();
      const state = url.searchParams.get("status") || "";
      const extension = url.searchParams.get("extension") || "";
      const requested = url.searchParams.get("page") || "1";
      if (!/^[1-9]\d*$/.test(requested) || !Number.isSafeInteger(Number(requested)) ||
        (state && !["available", "unavailable", "mixed", "unknown"].includes(state)) || (extension && !extensions.includes(extension))) {
        return Response.json({ error: "Filtros o página inválidos." }, { status: 400 });
      }
      const word = query.replace(/\.(?:(?:com|org|edu|gob)\.)?sv$/, "");
      const rows = db.query<Row, [string]>(`SELECT * FROM domains ORDER BY
        CASE WHEN ?1 = '' THEN 0 WHEN palabra = ?1 THEN 100
             WHEN instr(palabra, ?1) = 1 THEN 70 ELSE 30 END DESC,
        CASE WHEN ?1 <> '' THEN length(palabra) END,
        CASE WHEN ?1 <> '' THEN palabra END, rowid`).all(word);
      const groups = groupRows(rows);
      const filtered = groups.filter(group => (!query || group.palabra.includes(query) || group.domains.some(row => row.dominio.includes(query))) &&
        (!state || group.estado === state) && (!extension || group.domains.some(row => row.dominio === group.palabra + extension && row.estado !== "unknown")));
      const pages = Math.max(1, Math.ceil(filtered.length / 10));
      const page = Math.min(Number(requested), pages);
      return Response.json({ results: filtered.slice((page - 1) * 10, page * 10), total: filtered.length, count: groups.length, page, pages, indexed: rows.some(row => row.palabra === word) });
}

async function handle(request: Request) {
  const url = new URL(request.url);
  try {
    if (request.method === "POST" && url.pathname === "/api/consultar") return await handleConsult(request, url);
    if (request.method !== "GET") return new Response("Método no permitido", { status: 405 });
    if (url.pathname === "/") return new Response(html as unknown as string, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    if (url.pathname === "/api/whois") return await handleWhois(url);
    if (url.pathname === "/api/dominios") return handleDomains(url);
    return new Response("No encontrado", { status: 404 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "No se pudo completar la consulta." }, { status: 500 });
  }
}

export function serve() {
  for (let port = 3000; port <= 65535; port++) {
    try {
      const server = Bun.serve({ hostname: "127.0.0.1", port, fetch: handle });
      console.log(`Explorador disponible en ${server.url}`);
      return server;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    }
  }
  throw new Error("No hay puertos disponibles.");
}
