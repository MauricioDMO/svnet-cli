import { expect, mock, test } from "bun:test";
import { search, whois } from "../src/index.ts";

const SEARCH_HTML = `<div class="flex-container"><div class="col-6">
  <h4>Dominios Disponibles</h4>
  <div class="col-12"><strong>mi.org.sv</strong><button><i></i>Disponible</button></div>
  <div class="col-12"><strong>mi.edu.sv</strong><button>Disponible</button></div>
  <div class="col-12"><strong>mi.gob.sv</strong><button>Disponible</button></div>
  </div><div class="col-6"><h4>Dominios Registrados</h4>
  <div class="col-12"><strong>mi.sv</strong><button onClick="Whois(36876)"><i></i>Registrado</button></div>
  <div class="col-12"><strong>mi.com.sv</strong><button onclick="Whois(28661)">Registrado</button></div>
  </div></div>`;

const WHOIS_HTML = `<div><strong>mi.sv</strong><span>Registrado</span><table>
  <tr><td>Nombre de dominio:</td><td>&nbsp;mi.sv</td></tr>
  <tr><td>Estado:</td><td>&nbsp; Registrado</td></tr>
  <tr><td>Contacto Administrativo:</td><td>&nbsp;Mar&iacute;a &#209; &amp; Jos&eacute;</td></tr>
  <tr><td>Correo Electrónico:</td><td>contacto@example.com</td></tr>
  <tr><td>Teléfono:</td><td>+503 0000 0000</td></tr>
  <tr><td>Fecha Registro:</td><td>28-09-2026</td></tr>
  <tr><td>Fecha de vencimiento:</td><td>&nbsp;<strong>27-09-2027</strong></td></tr>
  <tr><td>Fecha de Baja:</td><td>27-10-2027</td></tr>
  </table></div>`;

test("búsqueda y WHOIS por nombre e ID, con validación y errores de transporte", async () => {
  const fetcher = mock(async (url, init) => {
    expect(url).toBe("https://svnet.sv/accion/procesos.php");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(URLSearchParams);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    return new Response(init.body.get("key") === "Buscar" ? SEARCH_HTML : WHOIS_HTML);
  });
  const options = { fetch: fetcher };
  const domains = await search(" MI ", options);
  expect(domains).toHaveLength(5);
  expect(domains[0]).toEqual({ domain: "mi.org.sv", status: "available", id: null });
  expect(domains[3]).toEqual({ domain: "mi.sv", status: "registered", id: 36876 });
  expect(fetcher.mock.calls[0][1].body.toString()).toBe("key=Buscar&ID=1&nombre=mi");
  expect(await search("MI.COM.SV.", options)).toEqual([domains[4]]);

  const record = await whois("mi.sv", options);
  expect(record).toEqual({
    domain: "mi.sv", status: "registered", id: 36876,
    administrativeContact: "María Ñ & José", email: "contacto@example.com",
    phone: "+503 0000 0000", registeredAt: "28-09-2026",
    expiresAt: "27-09-2027", deletionAt: "27-10-2027",
  });
  expect(fetcher.mock.calls.at(-1)[1].body.toString()).toBe("key=Whois&ID=36876");
  expect(await whois("mi", options)).toEqual(record);
  for (const id of [36876, "36876"]) {
    const count = fetcher.mock.calls.length;
    expect(await whois(id, options)).toEqual(record);
    expect(fetcher.mock.calls.length).toBe(count + 1);
  }
  const count = fetcher.mock.calls.length;
  expect(await whois("mi.org.sv", options)).toEqual(domains[0]);
  expect(fetcher.mock.calls.length).toBe(count + 1);
  await expect(search("mi.net.sv", options)).rejects.toThrow("no devolvió información");

  const reserved = `<div class="flex-container"><div class="alert alert-danger col-8">Este nombre de dominio: <strong>jobs</strong>\tes reservado por SVNet, no se puede registrar</div></div>`;
  await expect(search("jobs", { fetch: async () => new Response(reserved) })).rejects.toThrow("jobs es reservado por SVNet");

  const beforeInvalid = fetcher.mock.calls.length;
  for (const name of ["", "https://mi.sv", "mi.com", "mi&ID=2", "-mi", "a..sv", "a".repeat(64), "a.b.com.sv"]) {
    await expect(search(name, options)).rejects.toThrow();
  }
  for (const id of [0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1]) {
    await expect(whois(id, options)).rejects.toThrow("ID de WHOIS");
  }
  for (const timeout of [0, -1, NaN, 1.5, 2147483648]) {
    await expect(search("mi", { ...options, timeout })).rejects.toThrow("timeout");
  }
  expect(fetcher.mock.calls.length).toBe(beforeInvalid);

  for (const html of ["", "<h1>Error interno</h1>", SEARCH_HTML.replace("Whois(36876)", "nope()"), SEARCH_HTML.replace(">Disponible<", ">Desconocido<")]) {
    await expect(search("mi", { fetch: async () => new Response(html) })).rejects.toThrow();
  }
  for (const html of ["<p>ID no encontrado</p>", WHOIS_HTML.replaceAll("mi.sv", "otro.sv")]) {
    await expect(whois("mi.sv", {
      fetch: async (_, init) => new Response(init.body.get("key") === "Buscar" ? SEARCH_HTML : html),
    })).rejects.toThrow("Respuesta WHOIS");
  }
  await expect(search("mi", { fetch: async () => new Response("Error", { status: 503 }) })).rejects.toThrow("HTTP 503");
  await expect(search("mi", { fetch: async () => { throw new Error("sin conexión"); } })).rejects.toThrow("sin conexión");
  await expect(search("mi", { timeout: 10, fetch: async () => {
    throw new DOMException("timeout", "TimeoutError");
  } })).rejects.toThrow("10 ms");
});

test("el CLI muestra ayuda y falla sin consultar la red ante argumentos inválidos", () => {
  const cli = new URL("../bin/svnet.ts", import.meta.url).pathname;
  const run = (...args) => Bun.spawnSync([process.execPath, cli, ...args]);
  const help = run("--help");
  expect(help.exitCode).toBe(0);
  expect(help.stdout.toString()).toContain("svnet search <dominio>");
  expect(help.stdout.toString()).toContain("svnet whois <dominio|id>");
  for (const command of ["search", "whois"]) {
    const result = run(command, "https://mi.sv");
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain("Nombre inválido");
  }
  for (const args of [["desconocido", "mi"], ["whois"], ["-s"], ["-w"], ["-s", "-w", "mi"], ["-s", "whois", "mi"], ["search", "mi", "extra"], ["--no-existe"], ["search", "mi", "--timeout", "cero"]]) {
    const result = run(...args);
    expect(result.exitCode).toBe(1);
    expect(result.stdout.toString()).toBe("");
    expect(result.stderr.toString()).toContain("Error:");
  }
});

test("colores y progreso en terminal, limpieza al fallar o cancelar y pipes/JSON sin adornos", async () => {
  const cli = new URL("../bin/svnet.ts", import.meta.url);
  const run = async (args, { tty = false, env = {}, fail = false, cancel = false } = {}) => {
    const script = `
      process.argv = ${JSON.stringify([process.execPath, cli.pathname, ...args])};
      globalThis.fetch = async (_, init) => {
        await Bun.sleep(180);
        if (${fail}) throw new Error("sin conexión");
        return new Response(init.body.get("key") === "Buscar" ? ${JSON.stringify(SEARCH_HTML)} : ${JSON.stringify(WHOIS_HTML)});
      };
      await import(${JSON.stringify(cli.href)});
    `;
    let output = "";
    let interrupted = false;
    const proc = Bun.spawn([process.execPath, "-e", script], {
      env: { ...process.env, TERM: "xterm-256color", NO_COLOR: undefined, FORCE_COLOR: undefined, ...env },
      ...(tty ? {
        terminal: {
          cols: 100, rows: 24,
          data(_, data) {
            output += Buffer.from(data).toString();
            if (cancel && !interrupted && output.includes("Buscando disponibilidad")) {
              interrupted = true;
              proc.kill("SIGINT");
            }
          },
        },
      } : { stdout: "pipe", stderr: "pipe" }),
    });
    try {
      if (tty) return { code: await proc.exited, output };
      const [stdout, stderr, code] = await Promise.all([
        new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited,
      ]);
      return { code, output: stdout, stderr };
    } finally {
      proc.terminal?.close();
    }
  };

  const search = await run(["search", "mi"], { tty: true });
  expect(search.code).toBe(0);
  expect(search.output).toContain("Buscando disponibilidad");
  expect(search.output).toContain("\x1b[32mDisponible");
  expect(search.output).toContain("\x1b[33mRegistrado");
  expect(search.output).toContain("Dominios: 5 · Disponibles: 3 · Registrados: 2");
  expect(search.output).toContain("svnet whois mi.sv");
  expect(search.output).toContain("\r\x1b[2K\x1b[1;36mDominio");

  const whois = await run(["whois", "mi.sv"], { tty: true });
  expect(whois.code).toBe(0);
  expect(whois.output).toContain("Consultando WHOIS");
  expect(whois.output).toContain("María Ñ & José");

  const shortSearch = await run(["-s", "mi", "--json"]);
  expect(JSON.parse(shortSearch.output)).toHaveLength(5);
  expect(shortSearch.code).toBe(0);
  const shortWhois = await run(["-w", "mi.sv", "--json"]);
  expect(JSON.parse(shortWhois.output).domain).toBe("mi.sv");
  expect(shortWhois.code).toBe(0);

  const piped = await run(["search", "mi"]);
  expect(piped.code).toBe(0);
  expect(piped.stderr).toBe("");
  expect(piped.output).not.toContain("\x1b");
  expect(piped.output).not.toContain("Buscando");

  for (const tty of [false, true]) {
    const json = await run(["search", "mi", "--json"], { tty });
    expect(json.code).toBe(0);
    expect(JSON.parse(json.output)).toHaveLength(5);
    expect(json.output).not.toContain("\x1b");
  }
  for (const [args, env] of [
    [["--no-color"], {}], [[], { NO_COLOR: "1" }], [[], { TERM: "dumb" }],
  ]) {
    const plain = await run(["search", "mi", ...args], { tty: true, env });
    expect(plain.code).toBe(0);
    expect(plain.output).not.toMatch(/\x1b\[[\d;]*m/);
    if (env.TERM === "dumb") expect(plain.output).not.toContain("\x1b");
  }
  const failed = await run(["search", "mi"], { tty: true, fail: true });
  expect(failed.code).toBe(1);
  expect(failed.output).toContain("\r\x1b[2K\x1b[1;31mError:");
  expect(failed.output).toContain("sin conexión");

  for (const flag of ["--no-color", "--json"]) {
    const failed = await run(["whois", "mi.sv", flag], { tty: true, fail: true });
    expect(failed.code).toBe(1);
    expect(failed.output).not.toMatch(/\x1b\[[\d;]*m/);
    if (flag === "--json") expect(failed.output).not.toContain("\x1b");
  }

  const canceled = await run(["search", "mi"], { tty: true, cancel: true });
  expect(canceled.code).toBe(130);
  expect(canceled.output).toContain("\r\x1b[2KConsulta cancelada.");
}, 10000);
