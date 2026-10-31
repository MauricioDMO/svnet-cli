import type { Domain, WhoisRecord } from "./types";
import { color, statusLabel } from "./terminal";

export function output(result: Domain[] | Domain | WhoisRecord, json?: boolean) {
  if (json) {
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
      const labels: Record<string, string> = {
        domain: "Dominio", status: "Estado", id: "ID",
        administrativeContact: "Contacto administrativo", email: "Correo electrónico",
        phone: "Teléfono", registeredAt: "Fecha de registro",
        expiresAt: "Fecha de vencimiento", deletionAt: "Fecha de baja",
      };
      const width = Math.max(...Object.values(labels).map((label) => label.length));
      for (const [key, value] of Object.entries(result)) {
        const display = key === "status" ? statusLabel(String(value)) : key === "domain" ? color(String(value), 1) : value ?? color("—", 2);
        console.log(`${color(`${labels[key]}:`.padEnd(width + 1), 36)}  ${display}`);
      }
      if (result.status === "available") console.log(color("\nEste dominio está disponible; no tiene ficha WHOIS.", 2));
    }
}
