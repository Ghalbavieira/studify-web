"use client";

import { useState } from "react";
import { GoalSwitcher } from "@/components/goal-switcher";
import { AppShell } from "@/components/app-shell";
import { GoalForm } from "@/components/goal-form";
import { secondaryButtonClass } from "@/components/study-ui";
import { exportStudyData, useStudyData, refreshStudyData } from "@/lib/study-store";
import { STUDIFY_PLANS, formatPlanPrice } from "@/lib/plans";
import { usePlan } from "@/lib/use-plan";
import Link from "next/link";

export default function ConfiguracoesPage() {
  const { data, mode } = useStudyData();
  const [message, setMessage] = useState("");
  const { plan, status, loading: planLoading } = usePlan();
  const currentPlan = STUDIFY_PLANS[plan];
  return <AppShell><div className="mx-auto max-w-4xl"><header className="border-b border-line pb-5"><p className="text-sm text-muted">Seu espaço de estudo</p><h1 className="mt-1 text-3xl font-semibold">Configurações</h1></header><section className="border-b border-line py-6"><h2 className="mb-5 text-xl font-semibold">Objetivo e prova</h2><GoalSwitcher /><GoalForm key={data.goal?.id ?? "new-goal"} /></section><section className="border-b border-line py-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-muted">Plano atual</p><h2 className="mt-1 text-xl font-semibold">{planLoading ? "Carregando…" : currentPlan.name}</h2><p className="mt-2 text-sm text-secondary">{formatPlanPrice(currentPlan.priceMonthly)} · {plan === "free" ? "1 objetivo ativo · 1 edital/mês · 3 recomendações de IA/dia" : "painel completo · histórico completo · IA ampliada"}.</p></div><Link href="/planos" className={secondaryButtonClass}>Ver planos</Link></div><p className="mt-3 text-xs text-muted">Status: {status}. Trial e permissões são consultados no servidor. Gerencie sua assinatura e os pagamentos em Ver planos.</p></section><section className="border-b border-line py-6"><h2 className="text-xl font-semibold">Seus dados</h2><p className="mt-3 text-sm text-secondary">{mode === "cloud" ? "Conta conectada ao Supabase. Seus registros são sincronizados e separados dos dados de outros usuários." : "Modo local: os registros ficam apenas neste navegador. Exporte uma cópia para guardá-los."}</p><div className="mt-4 flex flex-wrap gap-3"><button className={secondaryButtonClass} onClick={() => { try { const blob = new Blob([exportStudyData()], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `studify-${new Date().toISOString().slice(0,10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage("Arquivo de dados preparado para download."); } catch { setMessage("Não foi possível exportar. Tente novamente."); } }}>Exportar meus dados</button>{mode === "cloud" && <button onClick={() => void refreshStudyData()} className={secondaryButtonClass}>Atualizar dados</button>}</div><p role="status" className="mt-3 text-sm text-accent">{message}</p></section><section className="border-b border-line py-6"><h2 className="text-xl font-semibold">Beta</h2><p className="mt-3 text-sm text-secondary">Encontrou um problema ou sentiu falta de algo durante o estudo? Registre aqui para priorizarmos o que afeta o uso real.</p><Link href="/feedback" className={`${secondaryButtonClass} mt-4 inline-block`}>Enviar feedback</Link></section><section className="py-6"><h2 className="text-xl font-semibold">Aparência</h2><p className="mt-3 text-sm text-muted">Tema escuro, cores sólidas e contraste para leitura prolongada. As animações respeitam a preferência de movimento reduzido do dispositivo.</p></section></div></AppShell>;
}
