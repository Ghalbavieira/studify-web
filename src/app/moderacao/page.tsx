"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, secondaryButtonClass } from "@/components/study-ui";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useStudyData } from "@/lib/study-store";

type Item = { kind: string; content_id: string; author_id: string | null; snapshot: Record<string, unknown>; revision: number; id?: string; reason?: string; details?: string };
type Queue = { reviews: Item[]; reports: Item[]; suspensions: Item[] };
type Action = "approve" | "reject" | "suspend" | "dismiss" | "restore";
const empty: Queue = { reviews: [], reports: [], suspensions: [] };
const labels: Record<Action, string> = { approve: "Aprovar", reject: "Remover/rejeitar", suspend: "Suspender autor", dismiss: "Encerrar sem infração", restore: "Restaurar conta" };

export default function ModeracaoPage() {
  const { mode, userId } = useStudyData();
  const [queue, setQueue] = useState<Queue>(empty);
  const [owner, setOwner] = useState("");
  const [tab, setTab] = useState<keyof Queue>("reports");
  const [decision, setDecision] = useState<{ item: Item; action: Action } | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true); setDecision(null); setQueue(empty); setError(""); setOwner("");
    try {
      if (mode !== "cloud" || !userId) throw new Error("Entre com uma conta autorizada para moderar.");
      const { data, error } = await getSupabaseClient().rpc("community_moderation_queue");
      if (error) throw new Error("Não foi possível abrir a fila. Confira se sua conta tem permissão de moderação e tente novamente.");
      if (generation.current === current) { setQueue(data as Queue); setOwner(userId); }
    } catch (error) { if (generation.current === current) setError(error instanceof Error ? error.message : "Não foi possível carregar a fila."); }
    finally { if (generation.current === current) setLoading(false); }
  }, [mode, userId]);
  useEffect(() => { const timer = setTimeout(() => void refresh(), 0); return () => { clearTimeout(timer); generation.current++; }; }, [refresh]);
  async function decide() {
    if (!decision || busy || owner !== userId || reason.trim().length < 3) return;
    setBusy(true); setError("");
    const current = generation.current;
    try {
      const { item, action } = decision;
      const result = action === "restore"
        ? await getSupabaseClient().rpc("community_restore_user", { p_user: item.content_id, p_reason: reason.trim() })
        : await getSupabaseClient().rpc("community_moderate", { p_kind: item.kind, p_id: item.content_id, p_revision: item.revision, p_action: action, p_reason: reason.trim(), p_report: item.id ?? null });
      if (result.error) throw new Error(result.error.message);
      if (generation.current === current) { setReason(""); await refresh(); }
    } catch (error) { if (generation.current === current) setError(error instanceof Error ? error.message : "Não foi possível registrar a decisão."); }
    finally { setBusy(false); }
  }
  const visible = mode === "cloud" && owner === userId;
  return <AppShell><main className="mx-auto max-w-4xl space-y-6">
    <header><h1 className="text-3xl font-semibold">Moderação</h1><p className="mt-3 text-muted">Revise o conteúdo e registre a justificativa. Denúncias de risco a crianças aparecem primeiro. Até 100 itens por fila; atualize após tratar os itens.</p></header>
    <nav aria-label="Filas de moderação" className="flex flex-wrap gap-3">{([["reports", "Denúncias"], ["reviews", "Revisão"], ["suspensions", "Suspensões"]] as const).map(([value, label]) => <button key={value} disabled={busy} aria-pressed={tab === value} className={secondaryButtonClass} onClick={() => { setTab(value); setDecision(null); }}>{label}{visible ? ` (${queue[value].length})` : ""}</button>)}</nav>
    <button disabled={busy || loading} className={secondaryButtonClass} onClick={() => void refresh()}>Atualizar fila</button>
    {loading && <p role="status">Carregando fila…</p>}{error && <p role="alert" className="text-danger">{error}</p>}
    {visible && !loading && !queue[tab].length && <p>Nenhum item nesta fila.</p>}
    {visible && queue[tab].map(item => {
      const actions: Action[] = tab === "suspensions" ? ["restore"] : ["approve", "reject", "suspend", ...(item.id ? ["dismiss" as const] : [])];
      return <article key={item.id ?? `${item.kind}:${item.content_id}`} className="space-y-4 rounded-lg border border-line bg-surface p-5">
        <h2 className="font-semibold">{item.kind} · {item.reason ?? "Aguardando revisão"}</h2>
        {item.details && <p className="whitespace-pre-wrap break-words">Relato: {item.details}</p>}
        <dl className="space-y-3">{Object.entries(item.snapshot).map(([key, value]) => <div key={key}><dt className="text-xs text-muted">{key}</dt><dd className="whitespace-pre-wrap break-all text-sm">{typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}</dd></div>)}</dl>
        <p className="break-all text-xs text-muted">Conteúdo: {item.content_id} · Revisão: {item.revision}</p>
        <div className="flex flex-wrap gap-2">{actions.map(action => <button key={action} disabled={busy || item.author_id === userId || (action === "suspend" && !item.author_id)} className={secondaryButtonClass} onClick={() => { setDecision({ item, action }); setReason(""); }}>{labels[action]}</button>)}</div>
        {decision?.item === item && <form className="space-y-3 border-t border-line pt-4" onSubmit={event => { event.preventDefault(); void decide(); }}>
          <h3 className="font-semibold">Confirmar: {labels[decision.action]}</h3>
          <label className="block">Justificativa da moderação<textarea required minLength={3} maxLength={1000} disabled={busy} value={reason} onChange={event => setReason(event.target.value)} className="mt-2 block min-h-24 w-full rounded-md border border-line bg-background p-3" /></label>
          <div className="flex gap-3"><button className={buttonClass} disabled={busy || reason.trim().length < 3}>Confirmar decisão</button><button type="button" className={secondaryButtonClass} disabled={busy} onClick={() => setDecision(null)}>Cancelar</button></div>
        </form>}
      </article>;
    })}
  </main></AppShell>;
}
