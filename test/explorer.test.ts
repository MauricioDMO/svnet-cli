import { test, expect } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";

test("importación, exclusión de sincronización y API del explorador", async () => {
  const dir = mkdtempSync(join(tmpdir(), "svnet-test-"));
  const env = { ...process.env, SVNET_DATA_DIR: dir };
  const cli = join(import.meta.dir, "../bin/svnet.ts");
  const run = async (...args: string[]) => {
    const proc = Bun.spawn([process.execPath, cli, ...args], { env, stdout: "pipe", stderr: "pipe" });
    return { code: await proc.exited, out: await new Response(proc.stdout).text(), err: await new Response(proc.stderr).text() };
  };
  let server: ReturnType<typeof Bun.spawn> | undefined;
  try {
    const csv = join(dir, "old.csv");
    writeFileSync(csv, "palabra,dominio,estado,id,indexado_en\nhola,hola.sv,registered,12,2026-01-01\n");
    expect((await run("sync", "import", csv)).code).toBe(0);
    expect(JSON.parse((await run("sync", "import", csv)).out).imported).toBe(0);

    const db = new Database(join(dir, "dominios.sqlite"));
    expect(JSON.parse((await run("sync", "status")).out).state).toBe("idle");
    db.query("UPDATE sync SET state='running', pid=? WHERE id=1").run(process.pid);
    const started = await run("sync", "start");
    expect(started.code).toBe(0);
    expect(JSON.parse(started.out)).toMatchObject({ state: "running", running: true, pid: process.pid });
    db.query("UPDATE sync SET pid=? WHERE id=1").run(2147483647);
    expect(JSON.parse((await run("sync", "progress")).out).state).toBe("interrupted");
    db.close();

    server = Bun.spawn([process.execPath, cli, "serve"], { env, stdout: "pipe", stderr: "pipe" });
    const reader = server.stdout!.getReader();
    const line = new TextDecoder().decode((await reader.read()).value);
    const base = line.match(/http:\/\/\S+/)?.[0];
    expect(base).toBeTruthy();
    const page = await fetch(base!);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(await page.text()).toContain("<h1>Explora .sv</h1>");
    const result = await (await fetch(`${base}api/dominios?q=hola`)).json();
    expect(result.results[0].palabra).toBe("hola");
    expect(result.results[0].sv).toBe("registered");
    expect((await fetch(`${base}api/dominios?page=-1`)).status).toBe(400);
    expect((await fetch(`${base}api/consultar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status).toBe(403);
  } finally {
    server?.kill();
    if (server) await server.exited;
    rmSync(dir, { recursive: true, force: true });
  }
}, 15000);

test("sync acepta una lista propia y solicita confirmación para la incluida", async () => {
  const dir = mkdtempSync(join(tmpdir(), "svnet-list-"));
  const env = { ...process.env, SVNET_DATA_DIR: dir };
  const cli = join(import.meta.dir, "../bin/svnet.ts");
  const run = async (args: string[], input = "") => {
    const proc = Bun.spawn([process.execPath, cli, ...args], { env, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    proc.stdin.write(input);
    proc.stdin.end();
    return { code: await proc.exited, out: await new Response(proc.stdout).text(), err: await new Response(proc.stderr).text() };
  };
  try {
    const cancelled = await run(["sync", "start"], "n\n");
    expect(cancelled.err).toContain("¿Usar la lista");
    expect(cancelled.out).toContain("cancelada");
    expect(JSON.parse((await run(["sync", "status"])).out).state).toBe("idle");

    const db = new Database(join(dir, "dominios.sqlite"));
    const insert = db.query("INSERT INTO domains VALUES (?, ?, 'reserved', NULL, NULL)");
    db.transaction(() => {
      for (const word of ["hola", "mundo"]) insert.run(word, word);
      for (const word of new Set(readFileSync(join(import.meta.dir, "../src/sync/es-5000.txt"), "utf8").trim().split(/\r?\n/))) insert.run(word, word);
    })();
    db.close();

    const file = join(dir, "palabras.txt");
    writeFileSync(file, "HOLA\nmundo\nhola\n");
    const result = await run(["sync", "start", file]);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.out)).toMatchObject({ source: file, total: 2, completed: 2 });
    writeFileSync(file, "modificado\n");
    expect(JSON.parse((await run(["sync", "progress"])).out)).toMatchObject({ source: file, total: 2, completed: 2 });

    writeFileSync(file, "mala palabra\n");
    expect((await run(["sync", "start", file])).err).toContain("Palabra inválida");
    const confirmed = await run(["sync", "start"], "s\n");
    expect(confirmed.code).toBe(0);
    expect(JSON.parse(confirmed.out)).toMatchObject({ source: "lista incluida", total: 4859, completed: 4859 });
    expect(JSON.parse((await run(["sync", "status"])).out).state).toBe("completed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 15000);
