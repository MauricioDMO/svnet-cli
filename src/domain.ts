const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeName(value: string) {
  if (typeof value !== "string") throw new Error("Escribe un nombre o dominio .sv.");
  const name = value.trim().toLowerCase().replace(/\.$/, "");
  const parts = name.split(".");
  if (!parts.every((part) => LABEL.test(part)) || parts.length > 3 ||
      (parts.length > 1 && parts.at(-1) !== "sv")) {
    throw new Error("Nombre inválido: usa mi, mi.sv o mi.com.sv (sin URL ni subdominios).");
  }
  return name;
}

