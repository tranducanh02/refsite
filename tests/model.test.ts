import test from "node:test";
import assert from "node:assert/strict";
import {
  actionSchema,
  applyAction,
  emptyLibrary,
  matchesSearch,
  normalizeUrl,
  validateLibrary,
  UNCATEGORY,
  type ResourceInput,
} from "../src/lib/model";

const input: ResourceInput = {
  title: "Bảng màu đẹp",
  url: "https://example.com/design",
  description: "Thiết kế cho sản phẩm",
  cover: "",
  folderId: "ui-inspo",
  tags: ["Figma"],
  favorite: false,
};
test("uncategorized folder is immutable and rejects nesting", () => {
  for (const action of [
    { type: "delete-folder", id: UNCATEGORY },
    { type: "save-folder", id: UNCATEGORY, name: "Renamed", parentId: null },
    { type: "save-folder", name: "Child", parentId: UNCATEGORY },
  ])
    assert.throws(() =>
      applyAction(emptyLibrary(), actionSchema.parse(action)),
    );
});
test("deleting a folder moves nested resources to Uncategory and preserves links", () => {
  let library = applyAction(emptyLibrary(), {
    type: "save-resource",
    resource: input,
  });
  library = applyAction(library, { type: "delete-folder", id: "product" });
  assert.equal(library.resources[0].folderId, UNCATEGORY);
  assert.equal(library.resources[0].url, input.url);
  assert(!library.folders.some((f) => f.id === "ui-inspo"));
  assert(library.folders.some((f) => f.id === "visual"));
});
test("cannot create cycles in folder hierarchy", () => {
  assert.throws(() =>
    applyAction(emptyLibrary(), {
      type: "save-folder",
      id: "product",
      name: "Product",
      parentId: "ui-inspo",
    }),
  );
  const invalid = emptyLibrary();
  invalid.folders.find((f) => f.id === "product")!.parentId = "ui-inspo";
  assert.throws(() => validateLibrary(invalid));
});
test("duplicate links ignore tracking and fragments but preserve meaningful query parameters", () => {
  const library = applyAction(emptyLibrary(), {
    type: "save-resource",
    resource: input,
  });
  assert.throws(() =>
    applyAction(library, {
      type: "save-resource",
      resource: {
        ...input,
        url: "https://example.com/design?utm_source=feed#section",
      },
    }),
  );
  assert.equal(
    normalizeUrl("https://example.com/?b=2&a=1"),
    normalizeUrl("https://example.com/?a=1&b=2"),
  );
  assert.notEqual(
    normalizeUrl("https://example.com/?page=1"),
    normalizeUrl("https://example.com/?page=2"),
  );
});
test("search matches Vietnamese without accents, descriptions, domains and tags", () => {
  const item = applyAction(emptyLibrary(), {
    type: "save-resource",
    resource: input,
  }).resources[0];
  assert(matchesSearch(item, "bang mau dep"));
  assert(matchesSearch(item, "thiet ke"));
  assert(matchesSearch(item, "figma example.com"));
  assert(!matchesSearch(item, "missing"));
});
test("imports merge matching folder paths and never overwrite existing resource edits", () => {
  const local = applyAction(emptyLibrary(), {
    type: "save-resource",
    resource: input,
  });
  let incoming = applyAction(emptyLibrary(), {
    type: "save-resource",
    resource: { ...input, title: "Old title" },
  });
  incoming = applyAction(incoming, {
    type: "save-resource",
    resource: { ...input, url: "https://another.example/test" },
  });
  const merged = applyAction(local, { type: "import", library: incoming });
  assert.equal(merged.resources.length, 2);
  assert.equal(merged.folders.length, local.folders.length);
  assert.equal(
    merged.resources.find((r) => r.url === input.url)?.title,
    input.title,
  );
  assert.equal(merged.resources[1].folderId, "ui-inspo");
  assert.equal(
    applyAction(merged, { type: "import", library: incoming }).resources.length,
    2,
  );
});
test("schema rejects javascript URLs and orphan folders from imported data", () => {
  assert(
    !actionSchema.safeParse({
      type: "save-resource",
      resource: { ...input, url: "javascript:alert(1)" },
    }).success,
  );
  const library = emptyLibrary();
  library.folders.push({
    id: "bad",
    name: "Bad",
    parentId: "missing",
    order: 0,
  });
  assert.throws(() => validateLibrary(library));
});
test("sample resources are opt-in and idempotent", () => {
  assert.equal(emptyLibrary().resources.length, 0);
  const library = applyAction(emptyLibrary(), { type: "load-samples" });
  assert.equal(library.resources.length, 8);
  assert.equal(
    applyAction(library, { type: "load-samples" }).resources.length,
    8,
  );
});
