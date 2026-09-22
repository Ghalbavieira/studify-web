import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabaseClient } from "@/lib/supabase/server";
import { BillingError } from "./asaas";

export function billingAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) throw new BillingError("Cobrança indisponível: falta configurar o acesso seguro ao banco no servidor.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function billingUser(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new BillingError("Entre na sua conta para gerenciar a assinatura.", 401);
  const client = getServerSupabaseClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new BillingError("Sessão expirada. Entre novamente.", 401);
  return { user: data.user, client };
}

export function billingResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export function billingFailure(error: unknown) {
  // Provider bodies, tokens, payment data and database details must never reach logs or clients.
  return billingResponse({ error: error instanceof BillingError ? error.message : "Não foi possível processar a assinatura. Consulte o status e tente novamente." }, error instanceof BillingError ? error.status : 503);
}
export function siteUrl() {
  const url = new URL(process.env.STUDIFY_APP_URL || "http://localhost:3000");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) throw new BillingError("URL da aplicação inválida.");
  return url.origin;
}
