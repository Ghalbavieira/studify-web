"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { buttonClass, inputClass } from "@/components/study-ui";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useStudyData } from "@/lib/study-store";

function FeedbackContent() {
  const params = useSearchParams();
  const { mode, userId } = useStudyData();
  const initialKind = params.get("type") === "pro" ? "pro_interest" : "feedback";
  const [kind, setKind] = useState<"feedback" | "bug" | "pro_interest">(initialKind);
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!message.trim()) { setStatus("Conte em uma frase o que você percebeu."); return; }
    if (mode !== "cloud" || !userId) { setStatus("Entre na sua conta para enviar feedback do beta."); return; }
    setBusy(true); setStatus("");
    try {
      const { error } = await getSupabaseClient().from("beta_feedback").insert({
        user_id: userId,
        kind,
        rating,
        message: message.trim(),
        page_path: window.location.pathname,
      });
      if (error) throw error;
      setMessage(""); setStatus(kind === "pro_interest" ? "Interesse no Pro registrado." : "Feedback enviado. Obrigada por testar o beta.");
    } catch {
      setStatus("Não foi possível enviar. Confirme que a migration 007 foi aplicada.");
    } finally { setBusy(false); }
  }

  return <AppShell><div className="mx-auto max-w-2xl"><header className="border-b border-line pb-5"><p className="text-sm text-accent">Beta Studify</p><h1 className="mt-1 text-3xl font-semibold">Ajude a melhorar o produto</h1><p className="mt-2 text-sm text-muted">Leva menos de um minuto. Priorize o que atrapalhou seu estudo de verdade.</p></header><section className="py-6 space-y-5"><label className="block text-sm text-secondary">Tipo<select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="feedback">Feedback</option><option value="bug">Encontrei um problema</option><option value="pro_interest">Tenho interesse no Pro</option></select></label><div><p className="text-sm text-secondary">Como foi usar o Studify hoje?</p><div className="mt-2 flex gap-2">{[[1,"😕"],[2,"😐"],[3,"🙂"],[4,"🤩"]].map(([value, face]) => <button key={value} type="button" onClick={() => setRating(Number(value))} className={`rounded-md border px-4 py-3 text-2xl ${rating === value ? "border-accent bg-accent-subtle" : "border-line bg-surface"}`}>{face}</button>)}</div></div><label className="block text-sm text-secondary">O que mais te ajudou ou atrapalhou?<textarea className={`${inputClass} mt-2 min-h-36 resize-y`} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex.: o cronômetro funcionou bem, mas não encontrei onde registrar questões..." /></label><button disabled={busy} onClick={() => void submit()} className={buttonClass}>{busy ? "Enviando…" : "Enviar"}</button><p role="status" className="text-sm text-accent">{status}</p></section></div></AppShell>;
}

export default function FeedbackPage() {
  return <Suspense fallback={<p role="status" className="p-6 text-muted">Carregando feedback…</p>}><FeedbackContent /></Suspense>;
}
