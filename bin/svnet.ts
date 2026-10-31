#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { search, whois } from "../src/index";
import { HELP } from "../src/help";
import { color, disableColor, progress } from "../src/terminal";
import { output } from "../src/output";

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
