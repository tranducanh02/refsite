import test from "node:test";
import assert from "node:assert/strict";
import { EditorHistory } from "../src/lib/editor-history";

test("typing is grouped while formatting and structural edits are separate undo steps", () => {
  const history = new EditorHistory<string>();
  history.record("", "text:a", 0);
  history.record("H", "text:a", 100);
  history.record("Hi", undefined, 200);
  assert.equal(history.undo("**Hi**"), "Hi");
  assert.equal(history.undo("Hi"), "");
  assert.equal(history.redo(""), "Hi");
  assert.equal(history.redo("Hi"), "**Hi**");
});

test("new edits invalidate redo, and field changes or pauses break typing groups", () => {
  const history = new EditorHistory<string>();
  history.record("0", "title", 0);
  history.record("1", "text:a", 100);
  history.record("2", "text:a", 1000);
  assert.equal(history.undo("3"), "2");
  history.record("2", "text:a", 1100);
  assert.equal(history.canRedo, false);
  assert.equal(history.undo("4"), "2");
  assert.equal(history.undo("2"), "1");
  history.closeGroup();
  assert.equal(history.undo("1"), "0");
  assert.equal(history.canUndo, false);
  assert.equal(history.undo("0"), undefined);
});

test("history is bounded and keeps immutable image/block references", () => {
  const history = new EditorHistory<object>(2);
  const image = { src: "data:image/png;base64,large-image", id: "image" };
  const states = [0, 1, 2, 3].map((title) => ({ title, blocks: [image] }));
  history.record(states[0]);
  history.record(states[1]);
  history.record(states[2]);
  assert.equal(history.undo(states[3]), states[2]);
  assert.equal(history.undo(states[2]), states[1]);
  assert.equal(history.undo(states[1]), undefined);
  assert.equal(
    (history.redo(states[1]) as (typeof states)[number]).blocks[0],
    image,
  );
});
