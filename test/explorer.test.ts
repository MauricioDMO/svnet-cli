import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
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
