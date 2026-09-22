"use client";

import { SafetyActions } from "./community-safety";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { postKindLabels, type Post, type SocialProfile } from "@/lib/social";
import { useSocial } from "@/lib/social-store";
import { UserAvatar } from "./user-avatar";
import { PostActions } from "./post-actions";
import { inputClass, secondaryButtonClass, timeLabel } from "../study-ui";

export function PostCard({ post, author, repostedBy }: { post: Post; author: SocialProfile; repostedBy?: string }) {
  const { me, update } = useSocial();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title ?? "");
  const [text, setText] = useState(post.text);
  const own = me.id === post.authorId;
  function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() || (post.kind !== "discussion" && !title.trim())) return;
    update((current) => ({ ...current, posts: current.posts.map((item) => item.id === post.id ? { ...item, title: post.kind === "discussion" ? null : title.trim(), text: text.trim() } : item) }));
    setEditing(false);
  }
  function remove() {
    if (!window.confirm("Excluir esta publicação e seus comentários?")) return;
    update((current) => ({
      ...current,
      posts: current.posts.filter((item) => item.id !== post.id),
      comments: current.comments.filter((item) => item.postId !== post.id),
      likes: current.likes.filter((item) => item.postId !== post.id),
      reposts: current.reposts.filter((item) => item.postId !== post.id),
      bookmarks: current.bookmarks.filter((item) => item.postId !== post.id),
    }));
  }
  return <article className="border-b border-line py-5">
    {repostedBy && <p className="mb-3 text-xs text-success">{repostedBy} repostou</p>}
    <div className="flex gap-3"><Link href={`/comunidade/${author.username}`}><UserAvatar profile={author} /></Link><div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><Link href={`/comunidade/${author.username}`} className="font-semibold hover:text-accent">{author.name}</Link><span className="text-xs text-muted">@{author.username}</span><span className="rounded-sm border border-line px-2 py-0.5 text-xs text-highlight">{postKindLabels[post.kind]}</span><Link href={`/comunidade/publicacao/${post.id}`} className="text-xs text-muted"><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</time></Link></div>
      {editing ? <form onSubmit={saveEdit} className="mt-4 space-y-3">{post.kind !== "discussion" && <label className="block text-sm">Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required className={inputClass} /></label>}<label className="block text-sm">Conteúdo<textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={post.kind === "discussion" ? 1000 : 5000} required rows={6} className={inputClass} /></label><div className="flex gap-3"><button className={secondaryButtonClass}>Salvar alterações</button><button type="button" onClick={() => { setEditing(false); setTitle(post.title ?? ""); setText(post.text); }} className="text-sm text-muted">Cancelar</button></div></form> : <>{post.title && <h2 className="mt-3 text-lg font-semibold">{post.title}</h2>}<p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-secondary">{post.text.split(/(#[\p{L}\p{N}_]+)/u).map((part, index) => part.startsWith("#") ? <Link key={index} href={`/comunidade?q=${encodeURIComponent(part)}`} className="text-accent">{part}</Link> : part)}</p></>}
      {post.media && <Link href={`/comunidade/publicacao/${post.id}`} className="mt-3 block"><Image unoptimized src={post.media.url} alt={post.media.alt} width={720} height={480} className="max-h-[480px] w-full rounded-lg object-contain bg-background-secondary" /></Link>}
      {(post.subject || post.topic || post.objective) && <p className="mt-3 text-xs text-highlight">{[post.subject, post.topic, post.objective].filter(Boolean).join(" · ")}</p>}
      {post.metrics && <p className="mt-3 text-xs text-accent">{timeLabel(post.metrics.seconds)} estudados · {post.metrics.questions} questões{post.metrics.accuracy !== null && ` · ${Math.round(post.metrics.accuracy * 100)}% de acerto`}</p>}
      {!editing && <PostActions postId={post.id} />}{own && !editing && <div className="mt-2 flex gap-4 text-xs"><button type="button" onClick={() => setEditing(true)} className="text-muted hover:text-foreground">Editar</button><button type="button" onClick={remove} className="text-error">Excluir</button></div>}<SafetyActions kind="post" id={post.id} authorId={post.authorId} />
    </div></div>
  </article>;
}
