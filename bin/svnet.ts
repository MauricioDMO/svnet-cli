#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { createInterface } from "node:readline";
import { search, whois } from "../src/index";
import { HELP } from "../src/cli/help";
import { color, disableColor, progress } from "../src/cli/terminal";
import { output } from "../src/cli/output";

try {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    options: {
      json: { type: "boolean" },
      "no-color": { type: "boolean" },
      help: { type: "boolean", short: "h" },
      search: { type: "boolean", short: "s" },
      whois: { type: "boolean", short: "w" },
      timeout: { type: "string" },
    },
  });
  disableColor(Boolean(values["no-color"] || values.json));
  if (values.help || (positionals.length === 0 && !values.search && !values.whois)) {
    console.log(HELP);
  } else if (!values.search && !values.whois && positionals[0] === "serve" && positionals.length === 1) {
    const { serve } = await import("../src/explorer/server");
    serve();
  } else if (!values.search && !values.whois && positionals[0] === "sync") {
    const { start, status, worker, importCsv, control } = await import("../src/sync");
    const action = positionals[1];
    if (action === "_worker" && positionals.length === 2) await worker();
    else if (action === "start" && (positionals.length === 2 || positionals.length === 3)) {
      const current = status();
      if (current.running) console.log(JSON.stringify(current, null, 2));
      else {
        if (!positionals[2] && !["paused", "interrupted", "error"].includes(current.state)) {
          process.stderr.write("¿Usar la lista de palabras incluida? [s/N] ");
          const lines = createInterface({ input: process.stdin });
          let answer = "";
          for await (const line of lines) { answer = line.trim().toLowerCase(); break; }
          lines.close();
          if (!["s", "si", "sí", "y", "yes"].includes(answer)) {
            console.log("Sincronización cancelada.");
            process.exit(0);
          }
        }
        console.log(JSON.stringify(await start(positionals[2]), null, 2));
      }
    }
    else if (["status", "progress"].includes(action) && positionals.length === 2) console.log(JSON.stringify(status(), null, 2));
    else if (["stop", "cancel"].includes(action) && positionals.length === 2) console.log(JSON.stringify(control(action as "stop" | "cancel"), null, 2));
    else if (action === "import" && positionals.length === 3) console.log(JSON.stringify(importCsv(positionals[2]), null, 2));
    else throw new Error("Usa svnet sync start [archivo.txt], stop, cancel, status, progress o import <archivo.csv>.");
  } else {
    const shortcut = values.search ? "search" : values.whois ? "whois" : null;
    const [command, value] = shortcut ? [shortcut, positionals[0]] : positionals;
    if ((values.search && values.whois) || positionals.length !== (shortcut ? 1 : 2) || !command || !["search", "whois"].includes(command)) {
      throw new Error("Usa svnet search <dominio> o svnet whois <dominio|id>. Consulta --help.");
    }
    const timeout = values.timeout === undefined ? 15000 : Number(values.timeout);
    const stop = progress(command === "search" ? "Buscando disponibilidad en SVNet…" : "Consultando WHOIS en SVNet…", values.json);
    let result;
    try {
      result = await (command === "search" ? search : whois)(value, { timeout });
    } finally {
      stop();
    }
    output(result, values.json);
  }
} catch (error) {
  process.stderr.write(`${color("Error:", "1;31", process.stderr)} ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
