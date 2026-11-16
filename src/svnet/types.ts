export interface RequestOptions {
  timeout?: number;
  fetch?: typeof globalThis.fetch;
}

export type Domain =
  | { domain: string; status: "available"; id: null }
  | { domain: string; status: "registered"; id: number };

export type WhoisRecord = Extract<Domain, { status: "registered" }> & {
  administrativeContact: string | null;
  email: string | null;
  phone: string | null;
  registeredAt: string | null;
  expiresAt: string | null;
  deletionAt: string | null;
};
