import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAction,
  emptyLibrary,
  validateLibrary,
  actionSchema,
} from "../src/lib/model";
import { newBlock, postMarkdown, type PostInput } from "../src/lib/blog";
import { mutateLocal, readLocal } from "../src/lib/local-store";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const post: PostInput = {
  title: "Kiến thức React",
  tags: ["React"],
  blocks: [
    newBlock("h2", "Điều vừa học"),
    newBlock("paragraph", "Nội dung tiếng Việt"),
  ],
};
const create = {
  type: "save-post" as const,
  id: "post-one",
  baseVersion: null,
  post,
};

test("existing libraries without posts remain readable and retain their resources", () => {
  const legacy = { ...emptyLibrary(), posts: undefined };
  const library = validateLibrary(legacy);
  assert.deepEqual(library.posts, []);
  assert.deepEqual(library.folders, legacy.folders);
});

test("post lifecycle preserves content, creation date and rejects stale editors", () => {
  const first = applyAction(emptyLibrary(), create, "2026-11-18T01:00:00.000Z");
  const edited = applyAction(
    first,
    { ...create, baseVersion: 0, post: { ...post, title: "Đã sửa" } },
    "2026-11-18T02:00:00.000Z",
  );
  assert.equal(edited.posts[0].editVersion, 1);
  assert.equal(edited.posts[0].createdAt, first.posts[0].createdAt);
  assert.throws(() => applyAction(edited, { ...create, baseVersion: 0 }));
  assert.throws(() => applyAction(first, create));
  const trashed = applyAction(edited, { type: "trash-post", id: create.id });
  assert(trashed.posts[0].deletedAt);
  assert.throws(() => applyAction(trashed, { ...create, baseVersion: 2 }));
  const restored = applyAction(trashed, {
    type: "restore-post",
    id: create.id,
  });
  assert.equal(restored.posts[0].deletedAt, null);
  assert.deepEqual(restored.posts[0].blocks, post.blocks);
  assert.equal(restored.posts[0].title, "Đã sửa");
  assert.throws(() => applyAction(restored, { ...create, baseVersion: 1 }));
});

test("image validation excludes scripts, external images and duplicate block IDs", () => {
  for (const src of [
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "https://example.com/private.png",
  ]) {
    assert.equal(
      actionSchema.safeParse({
        ...create,
        post: { ...post, blocks: [{ ...newBlock("image"), src }] },
      }).success,
      false,
    );
  }
  assert.equal(
    actionSchema.safeParse({
      ...create,
      post: {
        ...post,
        blocks: [
          { ...newBlock("image"), src: "data:image/png;base64,aGVsbG8=" },
        ],
      },
    }).success,
    true,
  );
  assert.equal(
    actionSchema.safeParse({
      ...create,
      post: { ...post, blocks: [post.blocks[0], post.blocks[0]] },
    }).success,
    false,
  );
});

test("backup import merges posts without replacing existing edits and includes trash", () => {
  const original = applyAction(emptyLibrary(), create);
  const backup = applyAction(
    applyAction(original, { ...create, id: "post-two" }),
    { type: "trash-post", id: "post-two" },
  );
  const edited = applyAction(original, {
    ...create,
    baseVersion: 0,
    post: { ...post, title: "Giữ bản mới" },
  });
  const imported = applyAction(edited, { type: "import", library: backup });
  assert.equal(imported.posts.length, 2);
  assert.equal(imported.posts[0].title, "Giữ bản mới");
  assert(imported.posts.find((p) => p.id === "post-two")?.deletedAt);
  assert.equal(
    applyAction(imported, { type: "import", library: backup }).posts.length,
    2,
  );
});

test("Markdown export contains headings, code, checklist and embedded images", () => {
  const output = postMarkdown({
    ...post,
    blocks: [
      ...post.blocks,
      { ...newBlock("check", "Hoàn thành"), checked: true },
      newBlock("code", "const answer = 42;"),
      {
        ...newBlock("image", "Chú thích"),
        src: "data:image/png;base64,aGVsbG8=",
      },
    ],
  });
  assert.match(output, /## Điều vừa học/);
  assert.match(output, /- \[x\] Hoàn thành/);
  assert.match(output, /```\nconst answer = 42;/);
  assert.match(output, /!\[Chú thích\]\(data:image\/png;base64,/);
});

test("posts persist across reads and concurrent stale saves cannot overwrite content", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "refsite-blog-"));
  try {
    const created = await mutateLocal(create, 0, directory);
    assert.deepEqual((await readLocal(directory)).posts, created.posts);
    const outcomes = await Promise.allSettled([
      mutateLocal(
        { ...create, baseVersion: 0, post: { ...post, title: "Thiết bị A" } },
        1,
        directory,
      ),
      mutateLocal(
        { ...create, baseVersion: 0, post: { ...post, title: "Thiết bị B" } },
        1,
        directory,
      ),
    ]);
    assert.equal(outcomes.filter((o) => o.status === "fulfilled").length, 1);
    assert.equal((await readLocal(directory)).posts[0].editVersion, 1);
  } finally {
    assert(
      path.resolve(directory).startsWith(path.resolve(os.tmpdir()) + path.sep),
    );
    await rm(directory, { recursive: true, force: true });
  }
});
