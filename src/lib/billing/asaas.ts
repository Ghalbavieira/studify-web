import "server-only";

export class BillingError extends Error {
  constructor(message: string, public status = 503, public code = "billing_error") {
    super(message);
    this.name = "BillingError";
  }
}

export function asaasConfig() {
  const key = process.env.ASAAS_API_KEY?.trim();
  const base = process.env.ASAAS_BASE_URL?.trim().replace(/\/$/, "");
  if (process.env.ASAAS_ENV?.trim().toLowerCase() !== "sandbox") throw new BillingError("Cobrança Sandbox indisponível. Verifique a configuração do servidor.", 503, "asaas_env_invalid");
  if (base !== "https://api-sandbox.asaas.com/v3") throw new BillingError("Cobrança Sandbox indisponível. Verifique a configuração do servidor.", 503, "asaas_base_url_invalid");
  if (!key) throw new BillingError("Cobrança Sandbox indisponível. Verifique a configuração do servidor.", 503, "asaas_api_key_missing");
  return { key, base };
}

export async function asaas<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const { key, base } = asaasConfig();
  const response = await fetch(`${base}${path}`, {
    method, cache: "no-store", signal: AbortSignal.timeout(65_000),
    headers: { access_token: key, "Content-Type": "application/json", "User-Agent": "Studify-Web/1.0" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new BillingError(
    `Asaas indisponível (HTTP ${response.status}). Tente consultar o status antes de repetir.`,
    response.status === 400 ? 422 : 503,
    `asaas_http_${response.status}`,
  );
  return response.json() as Promise<T>;
}

export type AsaasSubscription = { id: string; customer: string; externalReference?: string; value: number; cycle: string; description?: string; status: string; deleted?: boolean };
export type AsaasPayment = { id: string; customer: string; subscription?: string; externalReference?: string; status: string; value: number; dueDate: string; invoiceUrl?: string };
export type AsaasList<T> = { data: T[]; hasMore: boolean };

export function hostedUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "sandbox.asaas.com") throw new BillingError("Link de pagamento inválido.", 503, "asaas_hosted_url_invalid");
  return url.toString();
}
