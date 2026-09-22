"use client";

import { useState } from "react";
import { useStudyData } from "@/lib/study-store";
import { useSocial } from "@/lib/social-store";
import { postKindLabels, type PostDraft, type PostKind, type SocialMedia } from "@/lib/social";
import { buttonClass, inputClass } from "../study-ui";
import { UserAvatar } from "./user-avatar";
import { MediaUpload } from "./media-upload";

export function PostComposer({ onPublish, reply = false, groupId = null }: { onPublish: (draft: PostDraft) => void; reply?: boolean; groupId?: string | null }) {
  const { me } = useSocial();
  const { data } = useStudyData();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<PostKind>("discussion");
  const [title, setTitle] = useState("");
  const [media, setMedia] = useState<SocialMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [objective, setObjective] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const session = data.sessions.find(s => s.id === sessionId);
  const attempts = data.attempts.filter(a => a.studySessionId === sessionId);
  const questions = (session?.questions ?? 0) + attempts.length;
  const correct = (session?.correct ?? 0) + attempts.filter(a => a.isCorrect).length;
  const [error, setError] = useState("");
  return <form className="border-b border-line py-5" onSubmit={(event) => {
    event.preventDefault();
    if (busy || (!text.trim() && !media)) return;
    if (groupId && kind !== "discussion" && !title.trim()) { setError("Informe um título para o resumo ou anotação."); return; }
    try {
      onPublish({ kind: reply || !groupId ? "discussion" : kind, title: groupId && kind !== "discussion" ? title.trim() : null, text: text.trim(), media, subject: data.subjects.find((subject) => subject.id === subjectId)?.name ?? null, topic: data.topics.find((topic) => topic.id === topicId)?.title ?? null, objective: objective ? data.goal?.title ?? null : null, metrics: session ? { seconds: session.seconds, questions, accuracy: questions ? correct / questions : null } : null, groupId });
      setText(""); setTitle(""); setKind("discussion"); setSessionId(""); setMedia(null); setSubjectId(""); setTopicId(""); setObjective(false); setError("");
    } catch { setError("Não foi possível salvar. O armazenamento local pode estar cheio ou indisponível."); }
  }}>
    <div className="flex gap-3"><UserAvatar profile={me} /><div className="min-w-0 flex-1">
    {groupId && !reply && <div className="mb-4 grid gap-3 sm:grid-cols-2"><label className="text-sm text-secondary">Tipo<select value={kind} onChange={(event) => setKind(event.target.value as PostKind)} className={inputClass}>{Object.entries(postKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{kind !== "discussion" && <label className="text-sm text-secondary">Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required className={inputClass} placeholder={kind === "summary" ? "Título do resumo" : "Título da anotação"} /></label>}</div>}
    <label className="sr-only" htmlFor={reply ? "reply-text" : "post-text"}>{reply ? "Sua resposta" : kind === "discussion" ? "O que você estudou hoje?" : "Conteúdo"}</label><textarea id={reply ? "reply-text" : "post-text"} value={text} maxLength={groupId && kind !== "discussion" ? 5000 : 1000} onChange={(event) => setText(event.target.value)} placeholder={reply ? "Contribua com a conversa…" : kind === "summary" ? "Escreva seu resumo…" : kind === "note" ? "Escreva sua anotação…" : "O que você estudou hoje?"} rows={kind === "discussion" ? 3 : 7} className="w-full resize-y rounded-md bg-transparent px-1 py-2 text-base placeholder:text-muted" />
    {!reply && <details className="mb-3 text-sm text-muted"><summary className="cursor-pointer py-2">Relacionar aos meus estudos</summary><div className="grid gap-3 py-2 sm:grid-cols-2"><label>Matéria<select value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setTopicId(""); }} className={inputClass}><option value="">Sem matéria</option>{data.subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label>Tópico<select disabled={!subjectId} value={topicId} onChange={(event) => setTopicId(event.target.value)} className={inputClass}><option value="">Sem tópico</option>{data.topics.filter((topic) => topic.subjectId === subjectId).map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}</select></label></div>{data.goal && <label className="flex items-center gap-2 py-2"><input type="checkbox" checked={objective} onChange={(event) => setObjective(event.target.checked)} />{data.goal.title}</label>}</details>}
    {!reply && <label className="mb-4 block text-sm text-muted">Evidência de uma sessão<select value={sessionId} onChange={e => setSessionId(e.target.value)} className={inputClass}><option value="">Não compartilhar métricas</option>{[...data.sessions].sort((a,b) => b.endedAt.localeCompare(a.endedAt)).slice(0,30).map(s => <option key={s.id} value={s.id}>{data.subjects.find(x => x.id === s.subjectId)?.name} · {Math.round(s.seconds / 60)} min · {new Date(s.endedAt).toLocaleDateString("pt-BR")}</option>)}</select>{session && <span className="mt-2 block text-xs text-accent">{Math.round(session.seconds / 60)} min · {questions} questões{questions > 0 && ` · ${Math.round(correct / questions * 100)}% de acerto`}</span>}</label>}
    <MediaUpload media={media} onChange={setMedia} onBusy={setBusy} />
    <div className="mt-3 flex items-center justify-end gap-4"><span className={`text-xs ${text.length >= (groupId && kind !== "discussion" ? 4800 : 950) ? "text-attention" : "text-muted"}`}>{text.length}/{groupId && kind !== "discussion" ? 5000 : 1000}</span><button disabled={busy || (!text.trim() && !media) || Boolean(groupId && kind !== "discussion" && !title.trim())} className={buttonClass}>{busy ? "Carregando imagem…" : reply ? "Responder" : "Publicar"}</button></div>
    {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    </div></div>
  </form>;
}
