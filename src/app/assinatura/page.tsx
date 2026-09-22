"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useStudyData } from "@/lib/study-store";
import type { PlanState } from "@/lib/use-plan";

type Status = { entitlement: PlanState; billing: { checkout_id: string | null; subscription_id: string | null; subscription_status: string; checkout_status: string | null; cancel_requested_at: string | null; operation_started_at: string | null; payment_method: string | null } | null };
async function api(path: string, body?: unknown) {
  const { data } = await getSupabaseClient().auth.getSession();
  if (!data.session) throw new Error("Entre na sua conta para gerenciar a assinatura.");
  const response = await fetch(`/api/billing/${path}`, { method: body === undefined ? "GET" : "POST", cache: "no-store", headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Não foi possível consultar a assinatura.");
  return result;
}
export default function AssinaturaPage() {
  const { mode } = useStudyData();
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [method, setMethod] = useState("CREDIT_CARD");
  const refresh = useCallback(async () => {
    try { setStatus(await api("status")); setMessage(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao consultar status."); }
  }, []);
  useEffect(() => {
    if (mode !== "cloud") return;
    const timer = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15_000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [mode, refresh]);
  const billing = status?.billing;
  const existing = !!billing?.subscription_id && !["INACTIVE", "DELETED"].includes(billing.subscription_status);
  return <main className="mx-auto max-w-2xl px-5 py-12 text-foreground">
    <Link href="/planos" className="text-accent">← Planos</Link>
    <h1 className="mt-5 text-3xl font-semibold">Studify Pro</h1>
    <p className="mt-3 text-xl">R$ 14,90/mês</p>
    <p className="mt-2 text-secondary">15 dias grátis a partir da criação da conta. Cancele quando quiser. Após cancelar, seu acesso continua até o fim do período disponível; depois, você volta ao Free sem perder seus dados.</p>
    <p className="mt-4 rounded-md border border-line p-3 text-sm">Ambiente Sandbox: pagamentos de teste.</p>
    {mode !== "cloud" ? <Link className="mt-6 inline-block text-accent" href="/login">Entrar para assinar</Link> : <>
      <section className="my-6 rounded-lg border border-line p-5" aria-label="Status da assinatura">
        <h2 className="font-semibold">{status ? status.entitlement.plan === "pro" ? status.entitlement.status === "trialing" ? `Trial Pro · ${status.entitlement.trialDaysRemaining} dias restantes` : "Pro ativo" : "Plano Free" : "Consultando plano…"}</h2>
        {status?.entitlement.expiresAt && <p className="mt-2 text-sm">Fim do período de acesso: {new Date(status.entitlement.expiresAt).toLocaleString("pt-BR")}</p>}
        <p className="mt-2 text-sm text-secondary">{billing?.cancel_requested_at ? "Cancelamento solicitado. Aguardando confirmação ou já confirmado pelo Asaas." : existing ? "Assinatura cadastrada." : "Sem assinatura confirmada."}</p>
        {billing?.operation_started_at && <p className="mt-2 text-sm">Operação em processamento. Se persistir, solicite suporte para conciliar a contratação.</p>}
        <p className="mt-2 text-sm text-muted">Ao voltar do pagamento, aguarde a confirmação do Asaas. O retorno à página não confirma o pagamento.</p>
        <button onClick={() => void refresh()} className="mt-3 text-accent">Atualizar status</button>
      </section>
      {(!existing || billing?.payment_method === "PIX") && <form onSubmit={async event => {
        event.preventDefault(); setBusy(true); setMessage("");
        const form = new FormData(event.currentTarget);
        try { const result = await api("checkout", { name: form.get("name"), cpfCnpj: form.get("cpfCnpj"), method }); window.location.assign(result.url); }
        catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao abrir pagamento."); }
        finally { setBusy(false); }
      }} className="space-y-4">
        <label className="block">Nome completo<input name="name" autoComplete="name" required minLength={3} maxLength={100} className="mt-1 block w-full rounded border border-line bg-surface p-3" /></label>
        <label className="block">CPF ou CNPJ<input name="cpfCnpj" inputMode="numeric" required maxLength={18} className="mt-1 block w-full rounded border border-line bg-surface p-3" /></label>
        <label className="block">Forma de pagamento<select value={method} onChange={event => setMethod(event.target.value)} className="mt-1 block w-full rounded border border-line bg-surface p-3"><option value="CREDIT_CARD">Cartão de crédito</option><option value="PIX">PIX</option></select></label>
        <p className="text-sm text-secondary">{method === "PIX" ? "O PIX é pago manualmente a cada mês pela fatura do Asaas. Você pode aguardar o término do trial para pagar." : "Informe o cartão no checkout seguro do Asaas. A primeira cobrança fica agendada para depois do trial restante."}</p>
        <button disabled={busy || !!billing?.operation_started_at || !!billing?.cancel_requested_at && existing} className="w-full rounded bg-primary p-3 font-semibold disabled:opacity-50">{busy ? "Processando…" : existing ? "Abrir fatura" : "Continuar para pagamento"}</button>
      </form>}
      {(existing || !!billing?.checkout_id && !["CHECKOUT_CANCELED", "CHECKOUT_EXPIRED"].includes(billing.checkout_status || "")) && !billing?.cancel_requested_at && <div className="mt-6">
        {!confirmCancel ? <button onClick={() => setConfirmCancel(true)} className="text-secondary">Cancelar assinatura</button> : <><p>Deseja cancelar a renovação do Pro?</p><button disabled={busy} className="mr-5 mt-3 text-accent" onClick={async () => { setBusy(true); try { await api("cancel", {}); await refresh(); setConfirmCancel(false); } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao cancelar."); } finally { setBusy(false); } }}>Confirmar cancelamento</button><button onClick={() => setConfirmCancel(false)}>Manter assinatura</button></>}
      </div>}
    </>}
    <p role="status" className="mt-5 text-sm text-accent">{message}</p>
  </main>;
}
