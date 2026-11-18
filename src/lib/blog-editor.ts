import type { BlogBlock, BlogInline } from "./blog";

export function compactInline(parts: BlogInline[]): BlogInline[] {
  const result: BlogInline[] = [];
  const marks = [
    "bold",
    "italic",
    "underline",
    "strike",
    "code",
    "highlight",
  ] as const;
  for (const part of parts) {
    if (!part.text) continue;
    const last = result.at(-1);
    if (
      last &&
      last.href === part.href &&
      marks.every((key) => !!last[key] === !!part[key])
    )
      last.text += part.text;
    else result.push({ ...part });
  }
  return result;
}

/** Offsets count UTF-16 units, matching the editor's text and hard breaks. */
export function sliceInline(
  block: BlogBlock,
  from: number,
  to = block.text.length,
): BlogInline[] | undefined {
  if (!block.inline) return undefined;
  let offset = 0;
  return block.inline.flatMap((part) => {
    const start = offset;
    offset += part.text.length;
    const text = part.text.slice(
      Math.max(0, from - start),
      Math.max(0, to - start),
    );
    return text ? [{ ...part, text }] : [];
  });
}

export function reorderBlocks(
  blocks: BlogBlock[],
  source: string,
  target: string,
  edge: "before" | "after",
) {
  const moving = blocks.find((block) => block.id === source);
  if (
    !moving ||
    source === target ||
    !blocks.some((block) => block.id === target)
  )
    return blocks;
  const result = blocks.filter((block) => block.id !== source);
  const index = result.findIndex((block) => block.id === target);
  result.splice(index + (edge === "after" ? 1 : 0), 0, moving);
  return result;
}
