import { z } from "zod";

const mediaSchema = z.object({ url: z.string().max(1500000).refine((url) => /^data:image\/(png|jpeg|webp);base64,/.test(url) || url.startsWith("/social/") || /^https:\/\//.test(url)), alt: z.string().max(200) });
const profileSchema = z.object({ id: z.string(), username: z.string(), name: z.string(), bio: z.string(), avatar: mediaSchema.nullable(), objective: z.string(), subjects: z.array(z.string()), studiedSeconds: z.number().nonnegative().nullable() });
const metricsSchema = z.object({ seconds: z.number().nonnegative(), questions: z.number().nonnegative(), accuracy: z.number().min(0).max(1).nullable() });
export const postKinds = ["discussion", "summary", "note"] as const;
export type PostKind = typeof postKinds[number];
export const postKindLabels: Record<PostKind, string> = { discussion: "Discussão", summary: "Resumo", note: "Anotação" };
const postSchema = z.object({ id: z.string(), authorId: z.string(), kind: z.enum(postKinds).default("discussion"), title: z.string().trim().max(160).nullable().default(null), text: z.string().max(5000), media: mediaSchema.nullable(), createdAt: z.string(), subject: z.string().nullable(), topic: z.string().nullable(), objective: z.string().nullable(), metrics: metricsSchema.nullable(), groupId: z.string().nullable().default(null) }).refine((post) => post.text.trim() || post.media).refine((post) => post.kind === "discussion" || Boolean(post.title?.trim()), { message: "Resumos e anotações precisam de título." });
const commentSchema = z.object({ id: z.string(), postId: z.string(), authorId: z.string(), text: z.string().max(1000), media: mediaSchema.nullable(), createdAt: z.string() }).refine((comment) => comment.text.trim() || comment.media);
const actionSchema = z.object({ userId: z.string(), postId: z.string(), createdAt: z.string() });
const followSchema = z.object({ followerId: z.string(), followingId: z.string(), createdAt: z.string() });
const groupSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(1000),
  privacy: z.enum(["public", "private"]),
  objective: z.string().max(160),
  subjects: z.array(z.string()),
  rules: z.string().max(2000),
  cover: mediaSchema.nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
});
const groupMemberSchema = z.object({ groupId: z.string(), userId: z.string(), role: z.enum(["owner", "member"]), joinedAt: z.string() });

export const socialSchema = z.object({
  version: z.literal(1),
  profiles: z.array(profileSchema),
  posts: z.array(postSchema),
  comments: z.array(commentSchema),
  follows: z.array(followSchema),
  likes: z.array(actionSchema),
  reposts: z.array(actionSchema),
  bookmarks: z.array(actionSchema),
  groups: z.array(groupSchema).default([]),
  groupMembers: z.array(groupMemberSchema).default([]),
});

export type SocialProfile = z.infer<typeof profileSchema>;
export type Post = z.infer<typeof postSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type Follow = z.infer<typeof followSchema>;
export type Like = z.infer<typeof actionSchema>;
export type Repost = z.infer<typeof actionSchema>;
export type Bookmark = z.infer<typeof actionSchema>;
export type SocialMedia = z.infer<typeof mediaSchema>;
export type StudyGroup = z.infer<typeof groupSchema>;
export type GroupMember = z.infer<typeof groupMemberSchema>;
export type SocialData = z.infer<typeof socialSchema>;
export type PostDraft = Pick<Post, "kind" | "title" | "text" | "media" | "subject" | "topic" | "objective" | "metrics" | "groupId">;
export const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();

export function emptySocial(): SocialData {
  return { version: 1, profiles: [], posts: [], comments: [], follows: [], likes: [], reposts: [], bookmarks: [], groups: [], groupMembers: [] };
}

export function initialSocial(): SocialData {
  const profiles: SocialProfile[] = [
    { id: "ana", username: "ana.estuda", name: "Ana Martins", bio: "Aprendendo a estudar com constância. Redes, café e uma revisão de cada vez.", objective: "Dataprev 2026", subjects: ["Redes", "Segurança"], studiedSeconds: 28800, avatar: null },
    { id: "rafael", username: "rafael.dev", name: "Rafael Costa", bio: "Anotações de quem aprende construindo. Compartilho dúvidas e descobertas sobre desenvolvimento.", objective: "Front-end / React", subjects: ["React", "JavaScript"], studiedSeconds: 18000, avatar: null },
    { id: "julia", username: "julia.revisa", name: "Júlia Almeida", bio: "Transformando conteúdo em perguntas. Por aqui: revisão ativa e resumos de Direito.", objective: "OAB", subjects: ["Direito Constitucional"], studiedSeconds: 21600, avatar: null },
  ];
  const groups: StudyGroup[] = [
    { id: "group-dataprev", slug: "dataprev-2026", name: "Dataprev 2026", description: "Preparação focada em tecnologia, segurança e execução até a prova.", privacy: "public", objective: "Dataprev 2026", subjects: ["Redes", "Segurança", "Cloud"], rules: "Compartilhe estudo real, dúvidas específicas e materiais próprios.", cover: null, createdBy: "ana", createdAt: "2026-09-01T12:00:00Z" },
    { id: "group-oab", slug: "oab", name: "OAB", description: "Revisões, questões e organização para a preparação da OAB.", privacy: "public", objective: "OAB", subjects: ["Direito"], rules: "Respeito nas discussões e foco no estudo.", cover: null, createdBy: "julia", createdAt: "2026-09-02T12:00:00Z" },
    { id: "group-enem", slug: "enem", name: "ENEM", description: "Rotina, revisão e prática para quem está se preparando para o ENEM.", privacy: "public", objective: "ENEM", subjects: ["Matemática", "Linguagens"], rules: "Sem spam. Compartilhe o que ajuda a estudar melhor.", cover: null, createdBy: "ana", createdAt: "2026-09-03T12:00:00Z" },
    { id: "group-security", slug: "seguranca-cibernetica", name: "Segurança Cibernética", description: "AppSec, redes, IAM, cloud e fundamentos de defesa.", privacy: "public", objective: "Cybersecurity", subjects: ["Segurança", "Redes"], rules: "Conteúdo educacional e seguro. Não publicar credenciais ou dados sensíveis.", cover: null, createdBy: "rafael", createdAt: "2026-09-04T12:00:00Z" },
    { id: "group-react", slug: "front-end-react", name: "Front-end / React", description: "Estudo prático de React, JavaScript e interfaces.", privacy: "public", objective: "Front-end", subjects: ["React", "JavaScript"], rules: "Dúvidas objetivas, exemplos reproduzíveis e troca respeitosa.", cover: null, createdBy: "rafael", createdAt: "2026-09-05T12:00:00Z" },
  ];
  const draft = { kind: "discussion" as const, title: null, media: null, topic: null, metrics: null, groupId: null };
  const posts: Post[] = [
    { ...draft, id: "post-redes", authorId: "ana", text: "Hoje fiz uma revisão de sub-redes sem consultar as anotações. O que parecia claro na leitura ficou bem diferente quando precisei explicar.\n\nMinha próxima sessão já tem destino: praticar mais CIDR. #Redes #RevisãoAtiva", createdAt: "2026-09-11T15:10:00Z", subject: "Redes", topic: "Endereçamento IP", objective: "Dataprev 2026", metrics: { seconds: 4800, questions: 18, accuracy: 14 / 18 }, groupId: "group-dataprev" },
    { ...draft, id: "post-react", authorId: "rafael", text: "Uma pergunta que me ajudou a entender estado no React: esse valor precisa ser guardado ou pode ser calculado a partir de outro?\n\nMenos estado duplicado, menos bugs. #React #FrontEnd", createdAt: "2026-09-11T14:00:00Z", subject: "React", objective: "Front-end / React", groupId: "group-react" },
    { ...draft, id: "post-direito", authorId: "julia", text: "Troquei a releitura por cinco perguntas sobre controle de constitucionalidade. Demorou mais, mas agora sei exatamente onde estão minhas dúvidas.\n\nComo vocês organizam as questões que erraram? #OAB #Direito", createdAt: "2026-09-11T12:30:00Z", subject: "Direito Constitucional", objective: "OAB", groupId: "group-oab" },
  ];
  return {
    version: 1,
    profiles,
    posts,
    comments: [{ id: "comment-demo", postId: "post-redes", authorId: "rafael", text: "Explicar em voz alta também me ajuda muito. Tento criar um exemplo diferente depois de cada revisão.", media: null, createdAt: "2026-09-11T15:30:00Z" }],
    follows: [],
    likes: [{ userId: "rafael", postId: "post-redes", createdAt: "2026-09-11T15:20:00Z" }],
    reposts: [],
    bookmarks: [],
    groups,
    groupMembers: [
      { groupId: "group-dataprev", userId: "ana", role: "owner", joinedAt: "2026-09-01T12:00:00Z" },
      { groupId: "group-react", userId: "rafael", role: "owner", joinedAt: "2026-09-05T12:00:00Z" },
      { groupId: "group-oab", userId: "julia", role: "owner", joinedAt: "2026-09-02T12:00:00Z" },
      { groupId: "group-dataprev", userId: "rafael", role: "member", joinedAt: "2026-09-06T12:00:00Z" },
    ],
  };
}

export function socialFeed(data: SocialData, userId: string, following: boolean, query = "") {
  const allowed = new Set([userId, ...data.follows.filter((item) => item.followerId === userId).map((item) => item.followingId)]);
  const search = normalizeSearch(query.trim());
  return data.posts.flatMap((post) => {
    const author = data.profiles.find((profile) => profile.id === post.authorId);
    if (search && !normalizeSearch([post.title, post.text, post.subject, post.topic, post.objective, author?.name, author?.username].join(" ")).includes(search)) return [];
    const repost = data.reposts.filter((item) => item.postId === post.id && (!following || allowed.has(item.userId))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).at(0);
    if (following && !allowed.has(post.authorId) && !repost) return [];
    return [{ post, repost, date: repost && repost.createdAt > post.createdAt ? repost.createdAt : post.createdAt }];
  }).sort((a, b) => b.date.localeCompare(a.date));
}

export function slugifyGroupName(value: string) {
  return normalizeSearch(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "grupo";
}
