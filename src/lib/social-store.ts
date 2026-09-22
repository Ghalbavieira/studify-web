"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useStudyData } from "./study-store";
import { emptySocial, normalizeSearch, socialSchema, type SocialData, type SocialProfile } from "./social";
import { getSupabaseClient } from "./supabase/client";

const localFallback = emptySocial();
const cloudFallback = emptySocial();
const listeners = new Set<() => void>();
const localCache = new Map<string, { raw: string | null; data: SocialData }>();
const cloudCache = new Map<string, SocialData>();
const cloudLoading = new Map<string, Promise<void>>();
let cacheGeneration = 0;
export function clearSocialCache() { cacheGeneration++; cloudCache.clear(); cloudLoading.clear(); profileSignatures.clear(); localCache.clear(); emit(); }
const profileSignatures = new Map<string, string>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
};

function emit() {
  listeners.forEach((listener) => listener());
}

function readLocal(key: string) {
  const raw = localStorage.getItem(key);
  const previous = localCache.get(key);
  if (previous?.raw === raw) return previous.data;
  const data = raw ? socialSchema.parse(JSON.parse(raw)) : localFallback;
  localCache.set(key, { raw, data });
  return data;
}

function media(url: string | null, alt: string | null) {
  return url ? { url, alt: alt || "Imagem" } : null;
}

async function loadCloudData(userId: string, force = false) {
  if (!force && cloudCache.has(userId)) return;
  const running = cloudLoading.get(userId);
  if (running) return running;

  const generation = cacheGeneration;
  const request = (async () => {
    const supabase = getSupabaseClient();
    const [profiles, posts, comments, follows, likes, reposts, bookmarks, groups, members] = await Promise.all([
      supabase.from("social_profiles").select("user_id,username,display_name,bio,objective,avatar_url,avatar_alt,subjects,studied_seconds"),
      supabase.from("social_posts").select("id,user_id,kind,title,text,media_url,media_alt,subject,topic,objective,metrics,group_id,created_at").order("created_at", { ascending: false }).limit(300),
      supabase.from("social_comments").select("id,post_id,user_id,text,media_url,media_alt,created_at").order("created_at", { ascending: true }).limit(1000),
      supabase.from("social_follows").select("follower_id,following_id,created_at").limit(3000),
      supabase.from("social_likes").select("user_id,post_id,created_at").limit(5000),
      supabase.from("social_reposts").select("user_id,post_id,created_at").limit(5000),
      supabase.from("social_bookmarks").select("user_id,post_id,created_at").limit(2000),
      supabase.from("social_groups").select("id,slug,name,description,privacy,objective,subjects,rules,cover_url,cover_alt,created_by,created_at").order("created_at", { ascending: false }).limit(300),
      supabase.from("social_group_members").select("group_id,user_id,role,joined_at").limit(5000),
    ]);

    const result = [profiles, posts, comments, follows, likes, reposts, bookmarks, groups, members].find((item) => item.error);
    if (result?.error) throw result.error;

    const data = socialSchema.parse({
      version: 1,
      profiles: (profiles.data ?? []).map((row) => ({
        id: row.user_id,
        username: row.username,
        name: row.display_name || row.username,
        bio: row.bio || "",
        objective: row.objective || "",
        avatar: media(row.avatar_url, row.avatar_alt),
        subjects: row.subjects ?? [],
        studiedSeconds: row.studied_seconds === null ? null : Number(row.studied_seconds),
      })),
      posts: (posts.data ?? []).map((row) => ({
        id: row.id,
        authorId: row.user_id,
        kind: row.kind,
        title: row.title,
        text: row.text,
        media: media(row.media_url, row.media_alt),
        createdAt: row.created_at,
        subject: row.subject,
        topic: row.topic,
        objective: row.objective,
        metrics: row.metrics,
        groupId: row.group_id,
      })),
      comments: (comments.data ?? []).map((row) => ({
        id: row.id,
        postId: row.post_id,
        authorId: row.user_id,
        text: row.text,
        media: media(row.media_url, row.media_alt),
        createdAt: row.created_at,
      })),
      follows: (follows.data ?? []).map((row) => ({ followerId: row.follower_id, followingId: row.following_id, createdAt: row.created_at })),
      likes: (likes.data ?? []).map((row) => ({ userId: row.user_id, postId: row.post_id, createdAt: row.created_at })),
      reposts: (reposts.data ?? []).map((row) => ({ userId: row.user_id, postId: row.post_id, createdAt: row.created_at })),
      bookmarks: (bookmarks.data ?? []).map((row) => ({ userId: row.user_id, postId: row.post_id, createdAt: row.created_at })),
      groups: (groups.data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description || "",
        privacy: row.privacy,
        objective: row.objective || "",
        subjects: row.subjects ?? [],
        rules: row.rules || "",
        cover: media(row.cover_url, row.cover_alt),
        createdBy: row.created_by ?? "system",
        createdAt: row.created_at,
      })),
      groupMembers: (members.data ?? []).map((row) => ({ groupId: row.group_id, userId: row.user_id, role: row.role, joinedAt: row.joined_at })),
    });

    if (generation !== cacheGeneration) return;
    cloudCache.set(userId, data);
    emit();
  })().finally(() => cloudLoading.delete(userId));

  cloudLoading.set(userId, request);
  return request;
}

function keyOf(...parts: string[]) {
  return parts.join("::");
}

async function persistDiff(userId: string, before: SocialData, after: SocialData) {
  const supabase = getSupabaseClient();
  const operations: PromiseLike<unknown>[] = [];

  const beforeProfile = before.profiles.find((item) => item.id === userId);
  const afterProfile = after.profiles.find((item) => item.id === userId);
  if (afterProfile && JSON.stringify(beforeProfile) !== JSON.stringify(afterProfile)) {
    operations.push(supabase.from("social_profiles").upsert({
      user_id: userId,
      username: afterProfile.username,
      display_name: afterProfile.name,
      bio: afterProfile.bio,
      objective: afterProfile.objective,
      avatar_url: afterProfile.avatar?.url ?? null,
      avatar_alt: afterProfile.avatar?.alt ?? null,
      subjects: afterProfile.subjects,
      studied_seconds: afterProfile.studiedSeconds,
    }, { onConflict: "user_id" }).then(({ error }) => { if (error) throw error; }));
  }

  const diffCollection = <T,>(oldItems: T[], newItems: T[], key: (item: T) => string) => {
    const oldMap = new Map(oldItems.map((item) => [key(item), item]));
    const newMap = new Map(newItems.map((item) => [key(item), item]));
    return {
      added: newItems.filter((item) => !oldMap.has(key(item))),
      removed: oldItems.filter((item) => !newMap.has(key(item))),
      changed: newItems.filter((item) => oldMap.has(key(item)) && JSON.stringify(oldMap.get(key(item))) !== JSON.stringify(item)),
    };
  };

  const postDiff = diffCollection(before.posts, after.posts, (item) => item.id);
  for (const post of postDiff.added.filter((item) => item.authorId === userId)) {
    operations.push(supabase.from("social_posts").insert({ id: post.id, user_id: userId, kind: post.kind, title: post.title, text: post.text, media_url: post.media?.url ?? null, media_alt: post.media?.alt ?? null, subject: post.subject, topic: post.topic, objective: post.objective, metrics: post.metrics, group_id: post.groupId }).then(({ error }) => { if (error) throw error; }));
  }
  for (const post of postDiff.changed.filter((item) => item.authorId === userId)) {
    operations.push(supabase.from("social_posts").update({ kind: post.kind, title: post.title, text: post.text, subject: post.subject, topic: post.topic }).eq("id", post.id).eq("user_id", userId).then(({ error }) => { if (error) throw error; }));
  }
  for (const post of postDiff.removed.filter((item) => item.authorId === userId)) {
    operations.push(supabase.from("social_posts").delete().eq("id", post.id).then(({ error }) => { if (error) throw error; }));
  }

  const commentDiff = diffCollection(before.comments, after.comments, (item) => item.id);
  for (const comment of commentDiff.added.filter((item) => item.authorId === userId)) {
    operations.push(supabase.from("social_comments").insert({ id: comment.id, post_id: comment.postId, user_id: userId, text: comment.text, media_url: comment.media?.url ?? null, media_alt: comment.media?.alt ?? null }).then(({ error }) => { if (error) throw error; }));
  }
  for (const comment of commentDiff.removed.filter((item) => item.authorId === userId)) {
    operations.push(supabase.from("social_comments").delete().eq("id", comment.id).then(({ error }) => { if (error) throw error; }));
  }

  const followDiff = diffCollection(before.follows, after.follows, (item) => keyOf(item.followerId, item.followingId));
  for (const follow of followDiff.added.filter((item) => item.followerId === userId)) {
    operations.push(supabase.from("social_follows").insert({ follower_id: userId, following_id: follow.followingId }).then(({ error }) => { if (error) throw error; }));
  }
  for (const follow of followDiff.removed.filter((item) => item.followerId === userId)) {
    operations.push(supabase.from("social_follows").delete().eq("follower_id", userId).eq("following_id", follow.followingId).then(({ error }) => { if (error) throw error; }));
  }

  for (const [table, field] of [["social_likes", "likes"], ["social_reposts", "reposts"], ["social_bookmarks", "bookmarks"]] as const) {
    const actionDiff = diffCollection(before[field], after[field], (item) => keyOf(item.userId, item.postId));
    for (const action of actionDiff.added.filter((item) => item.userId === userId)) {
      operations.push(supabase.from(table).insert({ user_id: userId, post_id: action.postId }).then(({ error }) => { if (error) throw error; }));
    }
    for (const action of actionDiff.removed.filter((item) => item.userId === userId)) {
      operations.push(supabase.from(table).delete().eq("user_id", userId).eq("post_id", action.postId).then(({ error }) => { if (error) throw error; }));
    }
  }

  const groupDiff = diffCollection(before.groups, after.groups, (item) => item.id);
  for (const group of groupDiff.added.filter((item) => item.createdBy === userId)) {
    const { error } = await supabase.from("social_groups").insert({ id: group.id, slug: group.slug, name: group.name, description: group.description, privacy: group.privacy, objective: group.objective, subjects: group.subjects, rules: group.rules, cover_url: group.cover?.url ?? null, cover_alt: group.cover?.alt ?? null, created_by: userId });
    if (error) throw error;
  }

  const memberDiff = diffCollection(before.groupMembers, after.groupMembers, (item) => keyOf(item.groupId, item.userId));
  for (const member of memberDiff.added.filter((item) => item.userId === userId)) {
    operations.push(supabase.from("social_group_members").insert({ group_id: member.groupId, user_id: userId, role: member.role }).then(({ error }) => { if (error) throw error; }));
  }
  for (const member of memberDiff.removed.filter((item) => item.userId === userId && item.role !== "owner")) {
    operations.push(supabase.from("social_group_members").delete().eq("group_id", member.groupId).eq("user_id", userId).then(({ error }) => { if (error) throw error; }));
  }

  await Promise.all(operations);
}

async function syncProfile(profile: SocialProfile) {
  const signature = JSON.stringify(profile);
  if (profileSignatures.get(profile.id) === signature) return;
  const { error } = await getSupabaseClient().from("social_profiles").upsert({
    user_id: profile.id,
    username: profile.username,
    display_name: profile.name,
    bio: profile.bio,
    objective: profile.objective,
    avatar_url: profile.avatar?.url ?? null,
    avatar_alt: profile.avatar?.alt ?? null,
    subjects: profile.subjects,
    studied_seconds: profile.studiedSeconds,
  }, { onConflict: "user_id" });
  if (!error) profileSignatures.set(profile.id, signature);
}

export function useSocial() {
  const study = useStudyData();
  const cloud = study.mode === "cloud" && Boolean(study.userId);
  const userId = study.userId ?? "local-user";
  const key = `studify.social.v1.${userId}`;

  const baseUsername = normalizeSearch(study.data.profileName || "estudante").replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "estudante";
  const stored = cloud ? (cloudCache.get(userId) ?? cloudFallback) : undefined;
  const storedMe = stored?.profiles.find((profile) => profile.id === userId);
  const me = useMemo<SocialProfile>(() => ({
    id: userId,
    username: storedMe?.username || (cloud ? `${baseUsername}.${userId.slice(0, 6)}` : baseUsername),
    name: study.data.profileName || storedMe?.name || "Você",
    bio: storedMe?.bio ?? "Meu percurso de estudo, uma sessão de cada vez.",
    objective: storedMe?.objective ?? study.data.goal?.title ?? "",
    avatar: storedMe?.avatar ?? null,
    subjects: study.data.subjects.map((subject) => subject.name),
    studiedSeconds: study.data.sessions.reduce((sum, session) => sum + session.seconds, 0),
  }), [baseUsername, cloud, storedMe, study.data.goal?.title, study.data.profileName, study.data.sessions, study.data.subjects, userId]);

  const snapshot = useCallback(() => {
    const current = cloud ? (cloudCache.get(userId) ?? cloudFallback) : (() => { try { return readLocal(key); } catch { return localFallback; } })();
    return current;
  }, [cloud, key, userId]);
  const current = useSyncExternalStore(subscribe, snapshot, () => cloud ? cloudFallback : localFallback);
  const data = useMemo(() => ({ ...current, profiles: [...current.profiles.filter((profile) => profile.id !== userId), me] }), [current, me, userId]);

  useEffect(() => {
    if (!cloud || !study.ready) return;
    void loadCloudData(userId).then(() => syncProfile(me)).then(() => loadCloudData(userId, true)).catch(() => undefined);
    const refresh = () => { void loadCloudData(userId, true).catch(() => undefined); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [cloud, me, study.ready, userId]);

  function update(transform: (currentData: SocialData) => SocialData) {
    if (!study.ready) throw new Error("Aguarde seus dados carregarem.");
    const before = data;
    const next = socialSchema.parse(transform(before));
    if (!cloud) {
      localStorage.setItem(key, JSON.stringify(next));
      localCache.set(key, { raw: JSON.stringify(next), data: next });
      emit();
      return;
    }
    cloudCache.set(userId, next);
    emit();
    void persistDiff(userId, before, next)
      .then(() => loadCloudData(userId, true))
      .catch(async () => { window.dispatchEvent(new CustomEvent("studify-social-error", { detail: "Não foi possível salvar sua alteração. Confira as regras e tente novamente." })); await loadCloudData(userId, true); });
  }

  function toggle(kind: "likes" | "reposts" | "bookmarks", postId: string) {
    update((currentData) => ({
      ...currentData,
      [kind]: currentData[kind].some((item) => item.userId === userId && item.postId === postId)
        ? currentData[kind].filter((item) => !(item.userId === userId && item.postId === postId))
        : [...currentData[kind], { userId, postId, createdAt: new Date().toISOString() }],
    }));
  }

  return { data, me, update, toggle, refresh: () => cloud ? loadCloudData(userId, true) : Promise.resolve() };
}
