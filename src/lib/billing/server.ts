import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { BillingError } from "./asaas";

export function billingAdmin() {
  // Supabase accepts either the current sb_secret_* key or the legacy service_role JWT.
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) throw new BillingError("Cobrança indisponível: falta configurar o acesso seguro ao banco no servidor.", 503, "supabase_admin_config_missing");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function billingUser(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new BillingError("Entre na sua conta para gerenciar a assinatura.", 401, "auth_token_missing");
  const client = getServerSupabaseClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new BillingError("Sessão expirada. Entre novamente.", 401, "auth_token_invalid");
  return { user: data.user, client };
}

export function billingResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
type FailureContext = { operation: string; request?: Request };
type SupabaseError = { code?: unknown; status?: unknown };

export function supabaseFailure(error: SupabaseError, operation: string) {
  const databaseCode = typeof error.code === "string" ? error.code : "unknown";
  return new BillingError(
    "Não foi possível acessar os dados da assinatura. Consulte o status e tente novamente.",
    503,
    `supabase_${operation}_${databaseCode}`,
  );
}

export function billingFailure(error: unknown, context: FailureContext) {
  const failure = error instanceof BillingError ? error : new BillingError(
    "Não foi possível processar a assinatura. Consulte o status e tente novamente.",
    503,
    "unexpected_error",
  );
  const requestId = context.request?.headers.get("x-vercel-id") || randomUUID();
  // Log only classifications. Never log provider bodies, credentials, payment data or DB messages.
  console.error("[billing]", JSON.stringify({
    requestId,
    operation: context.operation,
    code: failure.code,
    status: failure.status,
    errorType: error instanceof Error ? error.name : typeof error,
  }));
  return billingResponse({ error: failure.message, code: failure.code, requestId }, failure.status);
}
export function siteUrl() {
  const configured = process.env.STUDIFY_APP_URL?.trim();
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const value = configured || (vercelHost ? `https://${vercelHost}` : process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  if (!value) throw new BillingError("URL pública da aplicação não configurada.", 503, "app_url_missing");
  const url = new URL(value);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) throw new BillingError("URL da aplicação inválida.", 503, "app_url_invalid");
  return url.origin;
}
