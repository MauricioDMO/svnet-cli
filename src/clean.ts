import { decodeHTML } from "entities/decode";

export function clean(text: string) {
  return decodeHTML(text).replace(/\s+/g, " ").replace(/[\x00-\x1f\x7f-\x9f]/g, "").trim();
}

