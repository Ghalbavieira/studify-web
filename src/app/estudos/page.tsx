"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Focus, Pause, Play, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FinishSession } from "@/components/finish-session";
import { EmptyState, buttonClass, inputClass, secondaryButtonClass } from "@/components/study-ui";
import { elapsedStudy, saveActiveStudy, useActiveStudy } from "@/lib/active-study";
import { useStudyData } from "@/lib/study-store";
import { pauseReminderLabels, reminderKinds, reminderNumber, usePauseReminderPreferences } from "@/lib/pause-reminders";

function StudyContent() {
  const params = useSearchParams();
  const { data, userId, ready } = useStudyData();
  const active = useActiveStudy();
  const { preferences: pausePreferences, save: savePausePreferences } = usePauseReminderPreferences(userId, ready);
  const block = data.blocks.find((block) => block.id === params.get("block"));
  const task = data.tasks.find((task) => task.id === params.get("task"));
  const [subjectChoice, setSubjectChoice] = useState("");
  const [topicChoice, setTopicChoice] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [focus, setFocus] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [message, setMessage] = useState("");
  const [dismissedReminder, setDismissedReminder] = useState<string | null>(null);
  const subjectId = active?.subjectId ?? (subjectChoice || block?.subjectId || task?.subjectId || params.get("subject") || data.subjects[0]?.id || "");
  const topicId = active ? active.topicId : (topicChoice ?? block?.topicId ?? task?.topicId ?? params.get("topic"));
  const suggested = block?.minutes ?? (task ? task.kind === "recall" ? 10 : 20 : 45);
  const duration = active ? active.durationSeconds / 60 : minutes ?? suggested;
  const elapsed = active ? elapsedStudy(active, now) : 0;
  const remaining = Math.max(0, duration * 60 - elapsed);
  const running = Boolean(active?.runningSince !== null && active && remaining > 0);
  const subject = data.subjects.find((subject) => subject.id === subjectId);
  const topic = data.topics.find((topic) => topic.id === topicId && topic.subjectId === subjectId);
  const dueReminder = active ? reminderNumber(elapsed, pausePreferences) : 0;
  const reminderKey = active && dueReminder > 0 ? `${active.id}:${dueReminder}` : null;
  const showPauseReminder = Boolean(reminderKey && reminderKey !== dismissedReminder);
  useEffect(() => { if (!active?.runningSince) return; const tick = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(tick); }, [active?.runningSince]);
  function changeDuration(value: number) {
    if (active && !window.confirm("Abandonar a contagem atual e alterar a duração? Nenhuma sessão salva será apagada.")) return;
    if (!Number.isInteger(value) || value < 1 || value > 1440) { setMessage("Escolha entre 1 e 1440 minutos inteiros."); return; }
    setMinutes(value); setCustom(String(value)); saveActiveStudy(userId, null); setMessage("");
  }
  function toggleTimer() {
    const clock = Date.now(); setNow(clock); setMessage("");
    if (!subject) return;
    if (!active) saveActiveStudy(userId, { id: crypto.randomUUID(), subjectId, topicId: topic?.id ?? null, blockId: block?.subjectId === subjectId ? block.id : null, taskId: task?.subjectId === subjectId ? task.id : null, durationSeconds: duration * 60, startedAt: new Date(clock).toISOString(), runningSince: clock, accumulatedSeconds: 0 });
    else saveActiveStudy(userId, { ...active, accumulatedSeconds: elapsedStudy(active, clock), runningSince: running ? null : clock });
  }
  return <AppShell><div className="mx-auto max-w-3xl"><header className="text-center"><p className="text-sm text-accent">Sessão de estudo</p><h1 className="mt-2 text-3xl font-semibold">Um bloco de cada vez.</h1></header>{!data.goal || !data.subjects.length ? <div className="mt-8"><EmptyState title="Prepare seu primeiro estudo" description="Adicione um objetivo e uma matéria para que o tempo registrado tenha contexto." href={!data.goal ? "/cadastro" : "/materias"} action={!data.goal ? "Criar objetivo" : "Adicionar matéria"} /></div> : <>
      {(!focus || !active) && <div className="mt-7 border-y border-line py-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-secondary">Matéria<select disabled={Boolean(active)} value={subjectId} onChange={(event) => { setSubjectChoice(event.target.value); setTopicChoice(""); }} className={inputClass}>{data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label className="text-sm text-secondary">Tópico<select disabled={Boolean(active)} value={topic?.id ?? ""} onChange={(event) => setTopicChoice(event.target.value)} className={inputClass}><option value="">Sem tópico específico</option>{data.topics.filter((topic) => topic.subjectId === subjectId).map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label></div><fieldset disabled={running} className="mt-4 disabled:opacity-50"><legend className="mb-2 text-xs text-muted">Duração em minutos</legend><div className="flex flex-wrap gap-2">{[10,15,20,30,40,45,60].map((value) => <button key={value} type="button" aria-pressed={duration === value} onClick={() => changeDuration(value)} className={`rounded-sm border px-3 py-2 text-sm ${duration === value ? "border-accent bg-accent-subtle text-accent" : "border-line text-secondary"}`}>{value}</button>)}</div><form className="mt-3 flex max-w-xs gap-2" onSubmit={(event) => { event.preventDefault(); changeDuration(Number(custom)); }}><input aria-label="Outro tempo em minutos" type="number" min={1} max={1440} step={1} required value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Outro tempo" className={`${inputClass} mt-0`} /><button className={secondaryButtonClass}>Aplicar</button></form></fieldset><p className="mt-2 text-xs text-muted">{active ? "Reiniciar ou alterar o tempo descarta a contagem atual, sem registrá-la." : "Escolha uma duração e comece quando estiver pronta."}</p><details className="mt-5 border-t border-line pt-4"><summary className="cursor-pointer text-sm font-semibold">Lembretes de pausa</summary><p className="mt-2 text-xs text-muted">Avisos opcionais disponíveis em todos os planos. Eles não pausam nem encerram o cronômetro.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={pausePreferences.enabled} onChange={(event) => savePausePreferences({ ...pausePreferences, enabled: event.target.checked })} />Ativar lembretes</label><label className="text-sm text-secondary">Intervalo em minutos<input type="number" min={10} max={180} step={5} disabled={!pausePreferences.enabled} value={pausePreferences.intervalMinutes} onChange={(event) => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 10 && value <= 180) savePausePreferences({ ...pausePreferences, intervalMinutes: value }); }} className={inputClass} /></label></div><fieldset disabled={!pausePreferences.enabled} className="mt-4 disabled:opacity-50"><legend className="text-sm text-secondary">Tipos de lembrete</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{reminderKinds.map((kind) => <label key={kind} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={pausePreferences.kinds.includes(kind)} onChange={(event) => { const kinds = event.target.checked ? [...pausePreferences.kinds, kind] : pausePreferences.kinds.filter((item) => item !== kind); if (kinds.length) savePausePreferences({ ...pausePreferences, kinds }); }} />{pauseReminderLabels[kind]}</label>)}</div></fieldset></details></div>}
      <section aria-label="Cronômetro" className="py-12 text-center sm:py-16"><p className="text-sm text-secondary">{subject?.name}{topic && ` · ${topic.title}`}</p><p className="mt-6 text-xs uppercase tracking-[.18em] text-muted">Tempo restante</p><div className={`mt-2 break-all font-mono font-medium tracking-tight tabular-nums ${duration >= 1000 ? "text-5xl" : "text-6xl sm:text-8xl"}`}>{String(Math.floor(remaining / 60)).padStart(2,"0")}:{String(remaining % 60).padStart(2,"0")}</div><p className="mt-3 text-sm text-muted">Meta: {duration} minutos</p><div className="mt-8 flex flex-wrap justify-center gap-3"><button disabled={remaining === 0 || !subject} onClick={toggleTimer} className={`${buttonClass} flex items-center gap-2 px-6 py-3`}>{running ? <Pause size={18} /> : <Play size={18} />}{running ? "Pausar" : active ? "Continuar" : "Iniciar"}</button><button onClick={() => { if (active && !window.confirm("Abandonar esta contagem? As tentativas salvas serão preservadas.")) return; saveActiveStudy(userId, null); setFinishing(false); setMessage("Contagem reiniciada. Nenhum tempo foi registrado."); }} className={`${secondaryButtonClass} flex items-center gap-2`}><RotateCcw size={17} />{active ? "Abandonar" : "Reiniciar"}</button><button disabled={!active || elapsed < 1} onClick={() => { if (!active) return; const clock = Date.now(); setNow(clock); saveActiveStudy(userId, { ...active, accumulatedSeconds: elapsedStudy(active, clock), runningSince: null }); setFinishing(true); }} className={`${secondaryButtonClass} flex items-center gap-2 text-success`}><Check size={17} />Finalizar</button></div>{showPauseReminder && reminderKey && <aside aria-live="polite" aria-label="Lembrete de pausa" className="mx-auto mt-8 max-w-xl rounded-md border border-line bg-background-secondary p-4 text-left"><h2 className="font-semibold">Pausa rápida?</h2><p className="mt-1 text-sm text-secondary">Você está estudando há {Math.floor(elapsed / 60)} minutos. O cronômetro continua normalmente.</p><div className="mt-4 flex flex-wrap gap-2">{pausePreferences.kinds.map((kind) => <button key={kind} type="button" onClick={() => { setDismissedReminder(reminderKey); setMessage(`${pauseReminderLabels[kind]} — volte quando estiver pronta.`); }} className={secondaryButtonClass}>{pauseReminderLabels[kind]}</button>)}<button type="button" onClick={() => setDismissedReminder(reminderKey)} className="min-h-11 px-3 text-sm text-muted">Continuar estudando</button></div></aside>}<p role="status" className="mt-4 text-sm text-success">{remaining === 0 ? "Tempo concluído. Finalize para registrar sua sessão." : message}</p></section>
      {!active && message.startsWith("Sessão registrada") && <div className="flex flex-wrap justify-center gap-4 border-t border-line py-5 text-sm"><Link href={`/questoes?subject=${subjectId}${topic?.id ? `&topic=${topic.id}` : ""}`} className="text-accent">Resolver questões →</Link><Link href="/revisoes" className="text-accent">Ver revisões →</Link><button onClick={toggleTimer} className="text-accent">Refazer sessão</button></div>}
      <div className="flex items-center justify-between border-t border-line py-4 text-sm"><div className="flex items-center gap-2 text-muted"><Focus size={17} /><span>Modo Foco <span className="text-xs">· ocultar configurações</span></span></div><button role="switch" aria-label="Modo Foco" aria-checked={focus} onClick={() => setFocus(!focus)} className={`relative h-7 w-12 rounded-md ${focus ? "bg-primary" : "bg-raised"}`}><span className={`absolute top-1 size-5 rounded-sm bg-foreground transition-all ${focus ? "left-6" : "left-1"}`} /></button></div>{!focus && block?.description && <p className="border-t border-line py-4 text-sm leading-6 text-secondary">{block.description}</p>}
      {finishing && active && <FinishSession active={active} seconds={elapsed} onClose={() => setFinishing(false)} onSaved={() => { setFinishing(false); setMessage("Sessão registrada. Revisões e recalls foram atualizados."); }} />}
    </>}</div></AppShell>;
}

export default function EstudosPage() { return <Suspense fallback={<p className="p-6 text-muted">Carregando sessão…</p>}><StudyContent /></Suspense>; }
