import type { RequestOptions } from "./types";

const ENDPOINT = "https://svnet.sv/accion/procesos.php";

export async function post(params: Record<string, string>, { timeout = 15000, fetch: fetcher = globalThis.fetch }: RequestOptions = {}) {
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
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error(`SVNet no respondió en ${timeout} ms.`, { cause: error });
    }
    throw new Error(`No se pudo consultar SVNet: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}

