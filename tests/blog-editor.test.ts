import test from "node:test";
import assert from "node:assert/strict";
import {
  blockSchema,
  newBlock,
  postMarkdown,
  type BlogBlock,
} from "../src/lib/blog";
import {
  compactInline,
  reorderBlocks,
  sliceInline,
} from "../src/lib/blog-editor";
import { applyAction, emptyLibrary, validateLibrary } from "../src/lib/model";

const formatted: BlogBlock = {
  ...newBlock("paragraph", "Học React\nhôm nay"),
  inline: [
    { text: "Học ", bold: true },
    { text: "React", italic: true, href: "https://react.dev" },
    { text: "\nhôm nay", highlight: true },
  ],
};

test("rich text survives persistence, JSON backup, restore and Markdown export", () => {
  const library = applyAction(emptyLibrary(), {
    type: "save-post",
    id: "rich-post",
    baseVersion: null,
    post: { title: "Bài mới", tags: [], blocks: [formatted] },
  });
  const reloaded = validateLibrary(JSON.parse(JSON.stringify(library)));
  assert.deepEqual(reloaded.posts[0].blocks[0], formatted);
  const restored = applyAction(
    applyAction(reloaded, { type: "trash-post", id: "rich-post" }),
    { type: "restore-post", id: "rich-post" },
  );
  assert.deepEqual(restored.posts[0].blocks[0], formatted);
  const markdown = postMarkdown(restored.posts[0]);
  assert.match(markdown, /\*\*Học\*\* /);
  assert.match(markdown, /\[\*React\*\]\(<https:\/\/react.dev>\)/);
  assert.match(markdown, /\n<mark>hôm nay<\/mark>/);
});

test("Enter splits styled text at the caret without losing marks or links", () => {
  assert.deepEqual(
    compactInline([
      ...(sliceInline(formatted, 0, 6) ?? []),
      ...(sliceInline(formatted, 6) ?? []),
    ]),
    formatted.inline,
  );
  assert.deepEqual(sliceInline(formatted, 0, 6), [
    { text: "Học ", bold: true },
    { text: "Re", italic: true, href: "https://react.dev" },
  ]);
  assert.deepEqual(sliceInline(formatted, 6), [
    { text: "act", italic: true, href: "https://react.dev" },
    { text: "\nhôm nay", highlight: true },
  ]);
  assert.deepEqual(
    sliceInline(formatted, 3, 5)
      ?.map((part) => part.text)
      .join(""),
    " R",
  );
  assert.deepEqual(sliceInline(formatted, formatted.text.length), []);
  assert.equal(sliceInline(newBlock("paragraph", "Bài cũ"), 2), undefined);
});

test("drop before and after works in both directions and preserves block identity", () => {
  const blocks = [formatted, newBlock("h2", "Heading"), newBlock("divider")];
  assert.deepEqual(reorderBlocks(blocks, blocks[0].id, blocks[2].id, "after"), [
    blocks[1],
    blocks[2],
    blocks[0],
  ]);
  assert.deepEqual(
    reorderBlocks(blocks, blocks[2].id, blocks[0].id, "before"),
    [blocks[2], blocks[0], blocks[1]],
  );
  assert.deepEqual(
    reorderBlocks(blocks, blocks[0].id, blocks[2].id, "before"),
    [blocks[1], blocks[0], blocks[2]],
  );
  assert.equal(
    reorderBlocks(blocks, blocks[0].id, blocks[0].id, "after"),
    blocks,
  );
  assert.equal(reorderBlocks(blocks, "missing", blocks[0].id, "after"), blocks);
});

test("server rejects unsafe links and inconsistent text while accepting old plain blocks", () => {
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "//evil.test",
    "java\nscript:alert(1)",
    "file:///etc/passwd",
  ]) {
    assert.equal(
      blockSchema.safeParse({
        ...newBlock("paragraph", "link"),
        inline: [{ text: "link", href }],
      }).success,
      false,
    );
  }
  assert.equal(
    blockSchema.safeParse({ ...formatted, text: "mismatch" }).success,
    false,
  );
  assert.equal(blockSchema.safeParse(formatted).success, true);
  assert.equal(
    blockSchema.safeParse(
      newBlock("paragraph", "Bài cũ <script>alert(1)</script>"),
    ).success,
    true,
  );
});
