"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { refreshStudyData, useStudyData } from "@/lib/study-store";
import { elapsedStudy, saveActiveStudy, useActiveStudy } from "@/lib/active-study";
import { buildPriorityContext, calculateDailyMetrics, calculateMetrics } from "@/lib/priority-engine";
import { localDate, type PlanBlock } from "@/lib/study-data";

const cardClass = "min-w-0 rounded-lg border border-line bg-surface p-4";
const textClass = "text-sm leading-[22px] text-secondary";
const actionClass = "flex min-h-12 w-full items-center justify-center rounded-lg px-[18px] text-center text-[15px] font-extrabold text-foreground disabled:cursor-not-allowed disabled:opacity-50";
const ghostClass = `${actionClass} bg-raised`;

function formatMinutes(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}min` : `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}min`;
}

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const rest = String(safe % 60).padStart(2, "0");
  return hours ? `${String(hours).padStart(2, "0")}:${minutes}:${rest}` : `${minutes}:${rest}`;
}

export default function HomePage() {
  const { data, ready, userId, mode } = useStudyData();
  const active = useActiveStudy();
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [feedback, setFeedback] = useState("");
  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), active ? 1000 : 60_000);
    return () => clearInterval(timer);
  }, [active]);

  const today = localDate(now);
  const daily = calculateDailyMetrics(data, now);
  const weekly = calculateMetrics(data, now);
  const priority = buildPriorityContext(data, now);
  const blocks = data.blocks.filter(block => block.date === today);
  // Match HomeScreen in Studify Mobile: today's first pending block, or its last completed block.
  const block = blocks.find(block => !block.done) ?? blocks.at(-1);
  const subject = data.subjects.find(subject => subject.id === block?.subjectId);
  const topic = data.topics.find(topic => topic.id === block?.topicId);
  const due = data.tasks.filter(task => !task.completedAt && task.dueDate <= today);
  const latest = new Map<string, boolean>();
  for (const attempt of [...data.attempts].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))) {
    latest.set(attempt.questionId, attempt.isCorrect);
  }
  const greeting = now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite";
  const name = (data.profileName.trim() || "Estudante").split(" ")[0];

  function begin(target: PlanBlock) {
    if (!ready || starting) return;
    setStarting(true);
    setFeedback("");
    try {
      if (!active) {
        const startedAt = Date.now();
        saveActiveStudy(userId, {
          id: crypto.randomUUID(), subjectId: target.subjectId, topicId: target.topicId,
          blockId: target.id, taskId: null, durationSeconds: target.minutes * 60,
          startedAt: new Date(startedAt).toISOString(), runningSince: startedAt, accumulatedSeconds: 0,
        });
      }
      router.push("/estudos");
    } catch {
      setFeedback("Não foi possível iniciar.");
      setStarting(false);
    }
  }

  return <AppShell>
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <header>
        <h1 className="text-[21px] font-black tracking-[-0.4px]">{greeting}, {name}</h1>
        <p className="mt-[3px] text-[13px] leading-[18px] text-muted">{data.goal?.title ?? "Defina seu próximo concurso."}</p>
      </header>

      {priority.daysToExam !== null && <p className="text-sm font-bold text-yellow">
        {priority.daysToExam >= 0 ? `Faltam ${priority.daysToExam} dias para sua prova` : "A data da prova passou. Atualize seu objetivo quando precisar."}
      </p>}
      {feedback && <p role="alert" className="text-sm text-red">{feedback}</p>}

      {!data.goal ? <Link href="/cadastro" className={`${actionClass} bg-blue`}>Configurar objetivo</Link> :
        <section aria-labelledby="today-focus" className={`${cardClass} border-violet`}>
          <div className="flex flex-col gap-3">
            <h2 id="today-focus" className="text-sm font-bold text-cyan">FOCO DE HOJE</h2>
            {block && subject ? <>
              <h3 className="text-2xl font-bold">{subject.name}</h3>
              <p className={textClass}>{topic?.title || block.description || "Estude e registre seu resultado."}</p>
              <p className={textClass}>{block.minutes} min · {block.plannedQuestions} questões</p>
              <button disabled={!ready || starting} onClick={() => begin(block)} className={`${actionClass} bg-blue`}>
                {starting ? "Iniciando…" : active ? "Continuar" : block.done ? "Refazer bloco" : "Começar"}
              </button>
            </> : <>
              <p className={textClass}>Nenhum bloco planejado para hoje</p>
              <Link href="/plano" className={`${actionClass} bg-blue`}>Criar bloco</Link>
              <Link href="/estudos" className={ghostClass}>Estudar sem planejamento</Link>
            </>}
          </div>
        </section>}

      {active && <section aria-labelledby="current-session" className={cardClass}>
        <h2 id="current-session" className="text-sm font-bold text-green">Sessão em andamento</h2>
        <p className={textClass}>{data.subjects.find(subject => subject.id === active.subjectId)?.name} · {formatClock(elapsedStudy(active, now.getTime()))} · {active.runningSince !== null && elapsedStudy(active, now.getTime()) < active.durationSeconds ? "Estudando" : "Pausada"}</p>
        <Link href="/estudos" className={`${actionClass} bg-blue`}>Continuar sessão</Link>
      </section>}

      <section aria-labelledby="pending" className={cardClass}>
        <h2 id="pending" className="text-sm font-bold">Pendências</h2>
        <p className={textClass}>{due.filter(task => task.kind === "review").length} revisões · {due.filter(task => task.kind === "recall").length} recalls · {[...latest.values()].filter(correct => !correct).length} questões erradas no objetivo</p>
        <Link href="/revisoes" className={ghostClass}>Abrir erros e revisões</Link>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="your-day" className={cardClass}>
          <h2 id="your-day" className="text-sm font-bold text-green">Seu dia</h2>
          <p className={textClass}>{formatMinutes(daily.executedSeconds)} de {formatMinutes(daily.plannedSeconds)} planejados · {daily.questions} questões · {daily.completedBlocks}/{daily.totalBlocks} blocos</p>
        </section>
        <section aria-labelledby="your-week" className={cardClass}>
          <h2 id="your-week" className="text-sm font-bold text-blue">Sua semana</h2>
          <p className={textClass}>{formatMinutes(weekly.executedSeconds)} de {formatMinutes(weekly.plannedSeconds)} planejados · {weekly.questions} questões · {weekly.completedBlocks}/{weekly.totalBlocks} blocos</p>
        </section>
      </div>

      <section aria-labelledby="recent-performance" className={cardClass}>
        <h2 id="recent-performance" className="text-sm font-bold">Desempenho recente</h2>
        <p className={textClass}>{weekly.accuracy === null ? "Registre questões para acompanhar sua taxa de acerto." : `${Math.round(weekly.accuracy * 100)}% de acerto em ${weekly.questions} questões nesta semana.`}</p>
        {priority.recommendation && <p className={textClass}>Atenção a {priority.recommendation.subject}: {priority.recommendation.reasons.slice(0, 2).join(" ")}</p>}
        <Link href="/analises" className={ghostClass}>Ver desempenho</Link>
      </section>

      <section aria-labelledby="community" className={cardClass}>
        <h2 id="community" className="text-sm font-bold text-pink">Comunidade</h2>
        <p className={textClass}>Compartilhe sua evolução e converse com quem também está estudando.</p>
        <Link href="/comunidade" className={ghostClass}>Abrir Comunidade</Link>
      </section>

      <button disabled={refreshing || !ready} className={ghostClass} onClick={async () => {
        setRefreshing(true);
        try {
          if (mode === "cloud") await refreshStudyData();
          setNow(new Date());
        } catch { setFeedback("Não foi possível atualizar seus dados. Tente novamente."); }
        finally { setRefreshing(false); }
      }}>{refreshing ? "Atualizando…" : "Atualizar dados"}</button>
    </div>
  </AppShell>;
}
