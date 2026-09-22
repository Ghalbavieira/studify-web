"use client";
import { usePlan } from "@/lib/use-plan";
import { useStudyData } from "@/lib/study-store";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { STUDIFY_PLANS, formatPlanPrice, type StudifyPlan } from "@/lib/plans";

const order: StudifyPlan[] = ["free", "pro"];

export default function PlanosPage() {
  const planState = usePlan();
  const { mode } = useStudyData();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-line bg-background-secondary">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Brand />
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-md px-3 py-2 text-sm text-secondary">Entrar</Link>
            <Link href="/cadastro" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold">Criar conta</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 lg:py-20">
        <div className="max-w-3xl"><Link href="/dashboard" className="text-sm text-accent">← Início</Link>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-accent">Planos do Studify</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">15 dias de Pro grátis.</h1>
          <p className="mt-5 text-lg leading-8 text-secondary">O plano gratuito mantém o núcleo do estudo funcionando. O Pro amplia histórico, análises, IA e importação de edital.</p>
        </div>

        <div role="status" className="mt-6 rounded-md border border-line bg-surface p-4">{mode === "cloud" ? planState.loading ? "Consultando seu plano…" : planState.error ? <>{planState.error} <button onClick={() => void planState.refresh()} className="text-accent">Atualizar</button></> : planState.status === "trialing" ? `Pro Trial · ${planState.trialDaysRemaining} dias restantes` : planState.plan === "pro" ? `Pro ativo${planState.expiresAt ? ` até ${new Date(planState.expiresAt).toLocaleDateString("pt-BR")}` : ""} · ${planState.billingStatus === "canceled" ? "renovação cancelada" : "assinatura ativa"}` : "Seu plano: Free" : "Novas contas recebem 15 dias de Pro. Depois, continuam no Free se não houver assinatura."}</div>
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {order.map((key) => {
            const plan = STUDIFY_PLANS[key];
            const isPro = key === "pro";
            return (
              <article key={key} className={`rounded-lg border p-6 ${isPro ? "border-violet bg-highlight-subtle" : "border-line bg-surface"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-accent">{plan.name}</p>
                    <h2 className="mt-2 text-3xl font-semibold">{formatPlanPrice(plan.priceMonthly)}{plan.priceMonthly > 0 && <span className="text-base font-normal text-muted">/mês</span>}</h2>
                    <p className="mt-2 text-sm leading-6 text-secondary">{plan.description}</p>
                  </div>
                  {isPro && <span className="rounded-md border border-violet/50 bg-surface px-2 py-1 text-xs font-semibold text-highlight">Mais completo</span>}
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => <li key={feature} className="flex gap-3 text-sm text-secondary"><Check size={17} className="mt-0.5 shrink-0 text-success" />{feature}</li>)}
                </ul>

                <Link href={mode === "cloud" ? isPro ? "/assinatura" : "/dashboard" : "/cadastro"} className={`mt-7 inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold ${isPro ? "bg-primary" : "border border-line bg-background-secondary"}`}>
                  {mode === "cloud" ? isPro ? "Assinar ou gerenciar Pro" : "Continuar estudando" : "Criar conta"} <ArrowRight size={17} />
                </Link>
                {isPro && <p className="mt-3 text-center text-xs text-muted">PIX ou cartão · 15 dias grátis por conta · cancele quando quiser. Pagamentos em Sandbox.</p>}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
