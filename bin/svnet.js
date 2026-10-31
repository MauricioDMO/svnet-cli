#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { search, whois } from "../src/index.js";

const HELP = `svnet — disponibilidad y WHOIS de dominios .sv

Uso:
  svnet search <dominio>       [--json] [--timeout <ms>]
  svnet whois <dominio|id>      [--json] [--timeout <ms>]
  svnet -s <dominio>            [--json] [--timeout <ms>]
  svnet -w <dominio|id>         [--json] [--timeout <ms>]

Ejemplos:
  svnet search mi
  svnet search mi.com.sv --json
  svnet whois mi.sv
  svnet whois 36876 --json

Opciones:
  --json          Salida JSON (estados: available, registered)
  --no-color      Desactivar colores (también respeta NO_COLOR)
  --timeout <ms>  Tiempo máximo por petición (15000 por defecto)
  -h, --help      Mostrar esta ayuda

WHOIS sin extensión consulta .sv. Un dominio disponible no tiene ficha WHOIS.`;

let noColor = "NO_COLOR" in process.env || process.env.TERM === "dumb";
const color = (text, code, stream = process.stdout) =>
  stream.isTTY && !noColor ? `\x1b[${code}m${text}\x1b[0m` : String(text);
const statusLabel = (status) => color(status === "available" ? "Disponible" : "Registrado", status === "available" ? 32 : 33);

function progress(message, quiet) {
  if (quiet || !process.stdout.isTTY || !process.stderr.isTTY || process.env.TERM === "dumb") return () => {};
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frame = 0;
  const draw = () => process.stderr.write(`\r\x1b[2K${color(frames[frame++ % frames.length], 36, process.stderr)} ${message.slice(0, Math.max(0, (process.stderr.columns || 80) - 3))}`);
  const timer = setInterval(draw, 80);
  const cancel = () => {
    stop();
    process.stderr.write("Consulta cancelada.\n");
    process.exit(130);
  };
  process.once("SIGINT", cancel);
  draw();
  function stop() {
    clearInterval(timer);
    process.removeListener("SIGINT", cancel);
    process.stderr.write("\r\x1b[2K");
  }
  return stop;
}

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
  noColor ||= values["no-color"] || values.json;
  if (values.help || (positionals.length === 0 && !values.search && !values.whois)) {
    console.log(HELP);
  } else {
    const shortcut = values.search ? "search" : values.whois ? "whois" : null;
    const [command, value] = shortcut ? [shortcut, positionals[0]] : positionals;
    if ((values.search && values.whois) || positionals.length !== (shortcut ? 1 : 2) || !["search", "whois"].includes(command)) {
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
    if (values.json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (Array.isArray(result)) {
      const width = Math.max(7, ...result.map(({ domain }) => domain.length));
      console.log(color(`${"Dominio".padEnd(width)}  Estado       ID`, "1;36"));
      for (const { domain, status, id } of result) {
        console.log(`${color(domain.padEnd(width), 1)}  ${statusLabel(status)}   ${color(id ?? "—", 2)}`);
      }
      if (process.stdout.isTTY) {
        const available = result.filter(({ status }) => status === "available").length;
        console.log(`\n${color(`Dominios: ${result.length} · Disponibles: ${available} · Registrados: ${result.length - available}`, 2)}`);
        const registered = result.find(({ status }) => status === "registered");
        if (registered) console.log(color(`Ver detalles: svnet whois ${registered.domain}`, 2));
      }
    } else {
      const labels = {
        domain: "Dominio", status: "Estado", id: "ID",
        administrativeContact: "Contacto administrativo", email: "Correo electrónico",
        phone: "Teléfono", registeredAt: "Fecha de registro",
        expiresAt: "Fecha de vencimiento", deletionAt: "Fecha de baja",
      };
      const width = Math.max(...Object.values(labels).map((label) => label.length));
      for (const [key, value] of Object.entries(result)) {
        const display = key === "status" ? statusLabel(value) : key === "domain" ? color(value, 1) : value ?? color("—", 2);
        console.log(`${color(`${labels[key]}:`.padEnd(width + 1), 36)}  ${display}`);
      }
      if (result.status === "available") console.log(color("\nEste dominio está disponible; no tiene ficha WHOIS.", 2));
    }
  }
} catch (error) {
  process.stderr.write(`${color("Error:", "1;31", process.stderr)} ${error.message}\n`);
  process.exitCode = 1;
}
