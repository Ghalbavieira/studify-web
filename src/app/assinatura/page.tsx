"use client";
import { useState } from "react";
import Link from "next/link";
import { useStudyData } from "@/lib/study-store";
import { billingApi, useBillingStatus } from "@/lib/use-billing-status";
export default function AssinaturaPage() {
  const { mode } = useStudyData();
  const { status, error: statusError, refresh } = useBillingStatus();
  const [message, setMessage] = useState("");
  const [paymentUrl, setPaymentUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [method, setMethod] = useState("CREDIT_CARD");
  const billing = status?.billing;
  const existing = !!billing?.subscription_id && !["INACTIVE", "DELETED"].includes(billing.subscription_status);
  const contracted = existing && ["ACTIVE", "PENDING"].includes(billing?.subscription_status || "");
  return <main className="mx-auto max-w-2xl px-5 py-12 text-foreground">
    <Link href="/planos" className="text-accent">← Planos</Link>
    <h1 className="mt-5 text-3xl font-semibold">Studify Pro</h1>
    <p className="mt-3 text-xl">R$ 14,90/mês</p>
    <p className="mt-2 text-secondary">15 dias grátis a partir da criação da conta. Cancele quando quiser. Após cancelar, seu acesso continua até o fim do período disponível; depois, você volta ao Free sem perder seus dados.</p>
    <p className="mt-4 rounded-md border border-line p-3 text-sm">Ambiente Sandbox: pagamentos de teste.</p>
    {mode !== "cloud" ? <Link className="mt-6 inline-block text-accent" href="/login">Entrar para assinar</Link> : <>
      <section className="my-6 rounded-lg border border-line p-5" aria-label="Status da assinatura">
        <h2 className="font-semibold">{status ? contracted ? "Pro contratado" : status.entitlement.plan === "pro" ? status.entitlement.status === "trialing" ? `Trial Pro · ${status.entitlement.trialDaysRemaining} dias restantes` : "Pro ativo" : "Plano Free" : "Consultando plano…"}</h2>
        {contracted && !!billing?.trial_days_remaining && <p className="mt-2 text-sm">Seu trial termina em {billing.trial_days_remaining} dias.</p>}
        {contracted && billing?.paid_until && <p className="mt-2 text-sm">Próxima renovação: {new Date(billing.paid_until).toLocaleDateString("pt-BR")}</p>}
        {status?.entitlement.expiresAt && <p className="mt-2 text-sm">Fim do período de acesso: {new Date(status.entitlement.expiresAt).toLocaleString("pt-BR")}</p>}
        <p className="mt-2 text-sm text-secondary">{billing?.cancel_requested_at ? "Cancelamento solicitado. Aguardando confirmação ou já confirmado pelo Asaas." : existing ? "Assinatura cadastrada." : "Sem assinatura confirmada."}</p>
        {billing?.operation_started_at && <p className="mt-2 text-sm">Operação em processamento. Se persistir, solicite suporte para conciliar a contratação.</p>}
        <p className="mt-2 text-sm text-muted">Ao voltar do pagamento, aguarde a confirmação do Asaas. O retorno à página não confirma o pagamento.</p>
        <button onClick={() => void refresh()} className="mt-3 text-accent">Atualizar status</button>
      </section>
      {(!existing || billing?.payment_method === "PIX") && <form onSubmit={async event => {
        event.preventDefault(); setBusy(true); setMessage("");
        const paymentTab = window.open("about:blank", "_blank");
        if (paymentTab) {
          paymentTab.opener = null;
          paymentTab.document.title = "Abrindo pagamento seguro…";
          const referrer = paymentTab.document.createElement("meta");
          referrer.name = "referrer"; referrer.content = "no-referrer";
          paymentTab.document.head.appendChild(referrer);
        }
        const form = new FormData(event.currentTarget);
        try {
          const result = await billingApi("checkout", { name: form.get("name"), cpfCnpj: form.get("cpfCnpj"), method });
          setPaymentUrl(result.url);
          if (paymentTab) paymentTab.location.replace(result.url);
          else window.open(result.url, "_blank", "noopener,noreferrer");
          setMessage("Pagamento aberto em outra aba. Se ela não aparecer, use o link abaixo. O Studify atualizará o status quando você voltar.");
        }
        catch (error) { paymentTab?.close(); setMessage(error instanceof Error ? error.message : "Falha ao abrir pagamento."); }
        finally { setBusy(false); }
      }} className="space-y-4">
        <label className="block">Nome completo<input name="name" autoComplete="name" required minLength={3} maxLength={100} className="mt-1 block w-full rounded border border-line bg-surface p-3" /></label>
        <label className="block">CPF ou CNPJ<input name="cpfCnpj" inputMode="numeric" required maxLength={18} className="mt-1 block w-full rounded border border-line bg-surface p-3" /></label>
        <label className="block">Forma de pagamento<select value={method} onChange={event => setMethod(event.target.value)} className="mt-1 block w-full rounded border border-line bg-surface p-3"><option value="CREDIT_CARD">Cartão de crédito</option><option value="PIX">PIX</option></select></label>
        <p className="text-sm text-secondary">{method === "PIX" ? "O PIX é pago manualmente a cada mês pela fatura do Asaas. Você pode aguardar o término do trial para pagar." : "Informe o cartão no checkout seguro do Asaas. A primeira cobrança fica agendada para depois do trial restante."}</p>
        <button disabled={busy || !!billing?.operation_started_at || !!billing?.cancel_requested_at && existing} className="w-full rounded bg-primary p-3 font-semibold disabled:opacity-50">{busy ? "Processando…" : existing ? "Abrir fatura" : "Continuar para pagamento"}</button>
      </form>}
      {(existing || !!billing?.checkout_id && !["CHECKOUT_CANCELED", "CHECKOUT_EXPIRED"].includes(billing.checkout_status || "")) && !billing?.cancel_requested_at && <div className="mt-6">
        {!confirmCancel ? <button onClick={() => setConfirmCancel(true)} className="text-secondary">Cancelar assinatura</button> : <><p>Deseja cancelar a renovação do Pro?</p><button disabled={busy} className="mr-5 mt-3 text-accent" onClick={async () => { setBusy(true); try { await billingApi("cancel", {}); await refresh(); setConfirmCancel(false); } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao cancelar."); } finally { setBusy(false); } }}>Confirmar cancelamento</button><button onClick={() => setConfirmCancel(false)}>Manter assinatura</button></>}
      </div>}
    </>}
    <p role="status" className="mt-5 text-sm text-accent">{message || statusError}</p>
    {paymentUrl && <a href={paymentUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-accent">Abrir pagamento em outra aba</a>}
  </main>;
}
