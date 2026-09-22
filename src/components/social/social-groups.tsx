"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "../app-shell";
import { buttonClass, inputClass, secondaryButtonClass } from "../study-ui";
import { useSocial } from "@/lib/social-store";
import { normalizeSearch, postKindLabels, slugifyGroupName, type PostKind, type SocialMedia, type StudyGroup } from "@/lib/social";
import { MediaUpload } from "./media-upload";
import { PostComposer } from "./post-composer";
import { PostCard } from "./post-card";
import { UserAvatar } from "./user-avatar";
import { MySocialProfileCard } from "./my-social-profile-card";

function CommunityNav({ active }: { active: "feed" | "groups" }) {
  return <nav className="mt-5 flex gap-6 border-b border-line" aria-label="Seções da comunidade">
    <Link href="/comunidade" className={`border-b-2 pb-3 text-sm font-semibold ${active === "feed" ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}>Feed</Link>
    <Link href="/comunidade/grupos" className={`border-b-2 pb-3 text-sm font-semibold ${active === "groups" ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}>Grupos</Link>
  </nav>;
}

function GroupCard({ group }: { group: StudyGroup }) {
  const { data, me, update } = useSocial();
  const groupId = group.id;
  const membership = data.groupMembers.find((member) => member.groupId === groupId && member.userId === me.id);
  const joined = Boolean(membership);
  const owner = membership?.role === "owner";
  const members = data.groupMembers.filter((member) => member.groupId === groupId).length;
  function toggleMembership() {
    if (owner) return;
    update((current) => ({
      ...current,
      groupMembers: joined
        ? current.groupMembers.filter((member) => !(member.groupId === groupId && member.userId === me.id))
        : [...current.groupMembers, { groupId, userId: me.id, role: "member", joinedAt: new Date().toISOString() }],
    }));
  }
  return <article className="border border-line bg-background-secondary p-4" style={{ borderRadius: 8 }}>
    <div className="flex gap-3">
      {group.cover ? <Image unoptimized src={group.cover.url} alt={group.cover.alt} width={54} height={54} className="h-[54px] w-[54px] object-cover" style={{ borderRadius: 8 }} /> : <div className="flex h-[54px] w-[54px] shrink-0 items-center justify-center bg-accent-subtle text-sm font-semibold text-accent" style={{ borderRadius: 8 }}>{group.name.slice(0, 2).toUpperCase()}</div>}
      <div className="min-w-0 flex-1">
        <Link href={`/comunidade/grupos/${group.slug}`} className="font-semibold hover:text-accent">{group.name}</Link>
        <p className="mt-1 text-xs text-muted">{members} membro{members === 1 ? "" : "s"} · {group.privacy === "public" ? "Público" : "Privado"}</p>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-secondary">{group.description}</p>
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between gap-3">
      <span className="text-xs text-highlight">{group.objective || group.subjects.slice(0, 2).join(" · ")}</span>
      <div className="flex gap-2"><Link href={`/comunidade/grupos/${group.slug}`} className={secondaryButtonClass}>Ver grupo</Link><button type="button" disabled={owner} onClick={toggleMembership} className={joined ? secondaryButtonClass : buttonClass}>{owner ? "Criador" : joined ? "Sair" : "Entrar"}</button></div>
    </div>
  </article>;
}

export function SocialGroupsPage() {
  const { data, me, update } = useSocial();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [cover, setCover] = useState<SocialMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const joinedIds = new Set(data.groupMembers.filter((member) => member.userId === me.id).map((member) => member.groupId));
  const myGroups = data.groups.filter((group) => joinedIds.has(group.id));
  const discover = data.groups.filter((group) => !joinedIds.has(group.id) && normalizeSearch([group.name, group.description, group.objective, group.subjects.join(" ")].join(" ")).includes(normalizeSearch(query)));

  function createGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    const baseSlug = slugifyGroupName(name);
    const slug = data.groups.some((group) => group.slug === baseSlug) ? `${baseSlug}-${Date.now().toString().slice(-5)}` : baseSlug;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    update((current) => ({
      ...current,
      groups: [...current.groups, {
        id,
        slug,
        name,
        description: String(form.get("description") ?? "").trim(),
        privacy: String(form.get("privacy")) === "private" ? "private" : "public",
        objective: String(form.get("objective") ?? "").trim(),
        subjects: String(form.get("subjects") ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12),
        rules: String(form.get("rules") ?? "").trim(),
        cover,
        createdBy: me.id,
        createdAt: now,
      }],
      groupMembers: [...current.groupMembers, { groupId: id, userId: me.id, role: "owner", joinedAt: now }],
    }));
    setCover(null);
    setCreating(false);
    event.currentTarget.reset();
  }

  return <AppShell><div className="mx-auto max-w-5xl">
    <header><div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold">Comunidade</h1><p className="mt-1 text-xs text-muted">Encontre pessoas e grupos que estudam na mesma direção.</p></div><button type="button" onClick={() => setCreating((value) => !value)} className={buttonClass}>{creating ? "Fechar" : "Criar grupo"}</button></div><CommunityNav active="groups" /></header>

    <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_240px]"><div className="min-w-0">
    {creating && <form onSubmit={createGroup} className="border border-line bg-background-secondary p-5" style={{ borderRadius: 8 }}>
      <h2 className="text-lg font-semibold">Criar grupo de estudo</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Nome<input name="name" maxLength={80} required className={inputClass} /></label>
        <label className="text-sm">Visibilidade<select name="privacy" className={inputClass}><option value="public">Público</option><option value="private">Privado</option></select></label>
        <label className="text-sm sm:col-span-2">Descrição<textarea name="description" maxLength={1000} rows={3} className={inputClass} /></label>
        <label className="text-sm">Objetivo / prova<input name="objective" maxLength={160} className={inputClass} placeholder="Ex.: Dataprev 2026" /></label>
        <label className="text-sm">Matérias<input name="subjects" className={inputClass} placeholder="Redes, Segurança, Cloud" /></label>
        <label className="text-sm sm:col-span-2">Regras<textarea name="rules" maxLength={2000} rows={3} className={inputClass} /></label>
        <div className="sm:col-span-2"><MediaUpload media={cover} onChange={setCover} onBusy={setBusy} /></div>
      </div>
      <div className="mt-5 flex justify-end"><button disabled={busy} className={buttonClass}>{busy ? "Carregando imagem…" : "Criar grupo"}</button></div>
    </form>}

    <section className="mt-8"><h2 className="text-lg font-semibold">Meus grupos</h2>{myGroups.length ? <div className="mt-4 grid gap-4 md:grid-cols-2">{myGroups.map((group) => <GroupCard key={group.id} group={group} />)}</div> : <p className="mt-3 text-sm text-muted">Você ainda não participa de nenhum grupo.</p>}</section>

    <section className="mt-10 border-t border-line pt-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-lg font-semibold">Descobrir grupos</h2><p className="mt-1 text-sm text-muted">Busque por prova, matéria ou tema.</p></div><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar grupos" className="w-full rounded-md border border-line bg-background-secondary px-4 py-2.5 text-sm sm:w-72" /></div><div className="mt-4 grid gap-4 md:grid-cols-2">{discover.map((group) => <GroupCard key={group.id} group={group} />)}</div>{!discover.length && <p className="mt-5 text-sm text-muted">Nenhum grupo encontrado.</p>}</section>
    </div><aside className="hidden xl:block"><MySocialProfileCard /></aside></div>
  </div></AppShell>;
}

export function SocialGroupPage({ slug }: { slug: string }) {
  const { data, me, update } = useSocial();
  const group = data.groups.find((item) => item.slug === slug);
  const [tab, setTab] = useState<"feed" | "members" | "rules">("feed");
  const [postKind, setPostKind] = useState<"all" | PostKind>("all");
  const [postQuery, setPostQuery] = useState("");
  const memberRecords = group ? data.groupMembers.filter((member) => member.groupId === group.id) : [];
  if (!group) return <AppShell><div className="mx-auto max-w-4xl"><Link href="/comunidade/grupos" className="text-sm text-accent">← Grupos</Link><h1 className="mt-8 text-2xl font-semibold">Grupo não encontrado.</h1></div></AppShell>;
  const groupId = group.id;
  const membership = memberRecords.find((member) => member.userId === me.id);
  const joined = Boolean(membership);
  const owner = membership?.role === "owner";
  const normalizedPostQuery = normalizeSearch(postQuery.trim());
  const posts = data.posts.filter((post) => post.groupId === groupId)
    .filter((post) => postKind === "all" || post.kind === postKind)
    .filter((post) => !normalizedPostQuery || normalizeSearch([post.title, post.text, post.subject, post.topic].join(" ")).includes(normalizedPostQuery))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function toggleMembership() {
    if (owner) return;
    update((current) => ({
      ...current,
      groupMembers: joined
        ? current.groupMembers.filter((member) => !(member.groupId === groupId && member.userId === me.id))
        : [...current.groupMembers, { groupId, userId: me.id, role: "member", joinedAt: new Date().toISOString() }],
    }));
  }

  return <AppShell><div className="mx-auto max-w-5xl">
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_240px]"><div className="min-w-0">
    <Link href="/comunidade/grupos" className="text-sm text-accent">← Grupos</Link>
    <header className="mt-5 border-b border-line pb-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {group.cover ? <Image unoptimized src={group.cover.url} alt={group.cover.alt} width={110} height={110} className="h-[110px] w-[110px] object-cover" style={{ borderRadius: 8 }} /> : <div className="flex h-[110px] w-[110px] shrink-0 items-center justify-center bg-accent-subtle text-2xl font-semibold text-accent" style={{ borderRadius: 8 }}>{group.name.slice(0, 2).toUpperCase()}</div>}
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-muted">{group.privacy === "public" ? "Grupo público" : "Grupo privado"}</p><h1 className="mt-1 text-3xl font-semibold">{group.name}</h1></div><button disabled={owner} onClick={toggleMembership} className={joined ? secondaryButtonClass : buttonClass}>{owner ? "Você criou este grupo" : joined ? "Sair do grupo" : "Entrar no grupo"}</button></div><p className="mt-3 max-w-2xl text-sm leading-7 text-secondary">{group.description}</p><p className="mt-3 text-xs text-highlight">{memberRecords.length} membro{memberRecords.length === 1 ? "" : "s"}{group.objective && ` · ${group.objective}`}</p></div>
      </div>
    </header>
    <div role="tablist" className="flex border-b border-line">{[["feed", "Publicações"], ["members", "Membros"], ["rules", "Regras"]].map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => setTab(value as typeof tab)} className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === value ? "border-accent text-accent" : "border-transparent text-muted"}`}>{label}</button>)}</div>

    {tab === "feed" && <section>{joined ? <PostComposer groupId={group.id} onPublish={(draft) => update((current) => ({ ...current, posts: [{ ...draft, id: crypto.randomUUID(), authorId: me.id, createdAt: new Date().toISOString() }, ...current.posts] }))} /> : <p className="border-b border-line py-5 text-sm text-muted">Entre no grupo para publicar. Você ainda pode acompanhar as publicações deste grupo público.</p>}<div className="grid gap-3 border-b border-line py-4 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="text-sm text-muted"><span className="sr-only">Buscar no conteúdo do grupo</span><input type="search" value={postQuery} onChange={(event) => setPostQuery(event.target.value)} placeholder="Buscar por título ou conteúdo" className="w-full rounded-md border border-line bg-background-secondary px-4 py-2.5 text-sm text-foreground" /></label><div role="group" aria-label="Filtrar publicações por tipo" className="flex flex-wrap gap-2">{([['all', 'Todos'], ...Object.entries(postKindLabels)] as ["all" | PostKind, string][]).map(([value, label]) => <button key={value} type="button" aria-pressed={postKind === value} onClick={() => setPostKind(value)} className={`rounded-md border px-3 py-2 text-xs ${postKind === value ? "border-accent bg-accent-subtle text-accent" : "border-line text-muted"}`}>{label}{value !== "all" && "s"}</button>)}</div></div>{posts.map((post) => { const author = data.profiles.find((profile) => profile.id === post.authorId); return author && <PostCard key={post.id} post={post} author={author} />; })}{!posts.length && <p className="py-10 text-sm text-muted">Nenhuma publicação encontrada com esses filtros.</p>}</section>}

    {tab === "members" && <section className="py-6"><div className="space-y-4">{memberRecords.map((member) => { const profile = data.profiles.find((item) => item.id === member.userId); if (!profile) return null; return <Link key={`${member.groupId}-${member.userId}`} href={`/comunidade/${profile.username}`} className="flex items-center gap-3"><UserAvatar profile={profile} /><span className="text-sm font-semibold">{profile.name}<span className="block text-xs font-normal text-muted">@{profile.username} · {member.role === "owner" ? "Criador" : "Membro"}</span></span></Link>; })}</div></section>}

    {tab === "rules" && <section className="py-6"><h2 className="font-semibold">Regras do grupo</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-secondary">{group.rules || "Este grupo ainda não definiu regras específicas."}</p>{group.subjects.length > 0 && <p className="mt-6 text-xs text-highlight">Matérias: {group.subjects.join(" · ")}</p>}</section>}
    </div><aside className="hidden xl:block"><MySocialProfileCard /></aside></div>
  </div></AppShell>;
}
