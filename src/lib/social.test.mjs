import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { initialSocial, socialFeed, socialSchema } from "./social.ts";

test("legacy discussions receive structured defaults", () => {
  const data = initialSocial();
  assert.ok(data.posts.every((post) => post.kind === "discussion" && post.title === null));
  assert.ok(socialSchema.safeParse(data).success);
});

test("group summaries and notes require a title and search includes it", () => {
  const data = initialSocial();
  const base = data.posts[0];
  data.posts.unshift({ ...base, id: "summary", kind: "summary", title: "Mapa de revisão espaçada", text: "Intervalos e recuperação ativa" });
  assert.ok(socialSchema.safeParse(data).success);
  assert.equal(socialFeed(data, "ana", false, "mapa de revisão")[0].post.id, "summary");
  assert.equal(socialSchema.safeParse({ ...data, posts: [{ ...base, kind: "note", title: "" }] }).success, false);
});

test("structured post migration preserves discussions and validates new kinds", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table social_posts (
      id uuid primary key, text text not null default '' constraint social_posts_text_check check (char_length(text) <= 1000),
      media_url text, group_id uuid, created_at timestamptz not null default now(),
      check (length(btrim(text)) > 0 or media_url is not null)
    ); insert into social_posts(id,text) values ('00000000-0000-4000-8000-000000000001','Discussão existente');`);
    const migration = await readFile(new URL("../../supabase/migrations/013_social_post_types.sql", import.meta.url), "utf8");
    await db.exec(migration);
    const existing = (await db.query("select kind,title,text from social_posts")).rows[0];
    assert.deepEqual(existing, { kind: "discussion", title: null, text: "Discussão existente" });
    await db.query("insert into social_posts(id,kind,title,text) values($1,'summary','Resumo de redes',$2)", ["00000000-0000-4000-8000-000000000002", "x".repeat(5000)]);
    await assert.rejects(db.query("insert into social_posts(id,kind,title,text) values($1,'note','',$2)", ["00000000-0000-4000-8000-000000000003", "Conteúdo"]));
  } finally { await db.close(); }
});
