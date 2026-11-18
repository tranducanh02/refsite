import { z } from "zod";

export const blockTypes = [
  "paragraph",
  "h1",
  "h2",
  "h3",
  "h4",
  "bullet",
  "number",
  "check",
  "quote",
  "code",
  "divider",
  "image",
] as const;
const blockId = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
export function safeBlogLink(value: string) {
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    return ["https:", "http:", "mailto:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
export const inlineSchema = z.object({
  text: z.string().min(1).max(100_000),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  code: z.boolean().optional(),
  highlight: z.boolean().optional(),
  href: z
    .string()
    .max(2000)
    .refine(safeBlogLink, "Liên kết không hợp lệ.")
    .optional(),
});
export type BlogInline = z.infer<typeof inlineSchema>;
export const blockSchema = z
  .object({
    id: blockId,
    type: z.enum(blockTypes),
    text: z.string().max(100_000),
    inline: z.array(inlineSchema).max(10_000).optional(),
    checked: z.boolean().optional(),
    src: z
      .string()
      .max(2_000_000)
      .regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/)
      .optional(),
  })
  .refine((b) => b.type !== "image" || !!b.src, "Ảnh chưa có dữ liệu.")
  .refine(
    (b) => !b.inline || b.inline.map((part) => part.text).join("") === b.text,
    "Định dạng không khớp với nội dung văn bản.",
  );
export const postInputSchema = z
  .object({
    title: z.string().trim().max(200),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    blocks: z.array(blockSchema).max(2000),
  })
  .refine(
    (p) => new Set(p.blocks.map((b) => b.id)).size === p.blocks.length,
    "Khối nội dung bị trùng ID.",
  )
  .refine(
    (p) => new TextEncoder().encode(JSON.stringify(p)).byteLength <= 6_000_000,
    "Bài viết tối đa 6 MB. Hãy giảm số ảnh hoặc chia thành nhiều bài.",
  );
export const postSchema = z
  .object({
    id: blockId,
    title: z.string().max(200),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    blocks: z.array(blockSchema).max(2000),
    editVersion: z.number().int().min(0),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    deletedAt: z.string().datetime().nullable(),
  })
  .refine(
    (p) => postInputSchema.safeParse(p).success,
    "Nội dung bài viết không hợp lệ.",
  );
export type BlogBlock = z.infer<typeof blockSchema>;
export type BlogPost = z.infer<typeof postSchema>;
export type PostInput = z.infer<typeof postInputSchema>;

export function newBlock(
  type: BlogBlock["type"] = "paragraph",
  text = "",
): BlogBlock {
  return { id: crypto.randomUUID(), type, text };
}
export function postText(post: PostInput) {
  return post.blocks.map((b) => b.text).join(" ");
}
export function postMarkdown(post: PostInput) {
  return (
    `# ${post.title || "Chưa đặt tiêu đề"}\n\n` +
    post.blocks
      .map((b) => {
        const text = inlineMarkdown(b);
        if (/^h[1-4]$/.test(b.type))
          return `${"#".repeat(Number(b.type[1]))} ${text}`;
        switch (b.type) {
          case "bullet":
            return `- ${text}`;
          case "number":
            return `1. ${text}`;
          case "check":
            return `- [${b.checked ? "x" : " "}] ${text}`;
          case "quote":
            return text
              .split("\n")
              .map((line) => `> ${line}`)
              .join("\n");
          case "code":
            return `\`\`\`\n${b.text}\n\`\`\``;
          case "divider":
            return "---";
          case "image":
            return `![${b.text.replace(/[\[\]]/g, "")}](${b.src})`;
          default:
            return text;
        }
      })
      .join("\n\n")
  );
}

function inlineMarkdown(block: BlogBlock) {
  if (!block.inline) return block.text;
  return block.inline
    .map((part) => {
      const leading = part.text.match(/^\s*/)?.[0] ?? "";
      const trailing = part.text.match(/\s*$/)?.[0] ?? "";
      const content = part.text.trim();
      if (!content) return part.text;
      let text = content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/[\\`*_[\]~]/g, "\\$&");
      if (part.code) {
        const fence = "`".repeat(
          Math.max(0, ...(content.match(/`+/g) ?? []).map((s) => s.length)) + 1,
        );
        text = `${fence} ${content} ${fence}`;
      }
      if (part.bold) text = `**${text}**`;
      if (part.italic) text = `*${text}*`;
      if (part.underline) text = `<u>${text}</u>`;
      if (part.strike) text = `~~${text}~~`;
      if (part.highlight) text = `<mark>${text}</mark>`;
      if (part.href)
        text = `[${text}](<${part.href.replace(/</g, "%3C").replace(/>/g, "%3E")}>)`;
      return leading + text + trailing;
    })
    .join("");
}
