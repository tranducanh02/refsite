import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { ConflictError, mutateLocal, readLocal } from "../src/lib/local-store";

test("local writes persist, back up previous state, and reject concurrent stale writes", async () => {
  const testRoot = path.resolve("test-results");
  await mkdir(testRoot, { recursive: true });
  const directory = await mkdtemp(path.join(testRoot, "store-"));
  try {
    const initial = await readLocal(directory);
    assert.equal(initial.revision, 0);
    const first = await mutateLocal({ type: "load-samples" }, 0, directory);
    assert.equal((await readLocal(directory)).resources.length, 8);
    const outcomes = await Promise.allSettled([
      mutateLocal(
        { type: "favorite", id: first.resources[0].id, favorite: true },
        1,
        directory,
      ),
      mutateLocal(
        { type: "favorite", id: first.resources[1].id, favorite: true },
        1,
        directory,
      ),
    ]);
    assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
    const rejected = outcomes.find(
      (r) => r.status === "rejected",
    ) as PromiseRejectedResult;
    assert(rejected.reason instanceof ConflictError);
    assert.equal((await readLocal(directory)).revision, 2);
    assert.equal(
      JSON.parse(
        await readFile(path.join(directory, "library.json.bak"), "utf8"),
      ).revision,
      1,
    );
  } finally {
    // mkdtemp produced this task-owned directory immediately above.
    assert(path.resolve(directory).startsWith(testRoot + path.sep));
    await rm(directory, { recursive: true, force: true });
  }
});
