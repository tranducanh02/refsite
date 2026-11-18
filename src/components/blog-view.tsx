"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import type { Editor } from "@tiptap/core";
import { EditorHistory } from "@/lib/editor-history";
import { InlineText, RichBlockText } from "./blog-rich-text";
import { compactInline, reorderBlocks, sliceInline } from "@/lib/blog-editor";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  Download,
  ImagePlus,
  GripVertical,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Undo2,
  Redo2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { type LibraryAction, searchText } from "@/lib/model";
import {
  newBlock,
  postInputSchema,
  postMarkdown,
  postText,
  type BlogBlock,
  type BlogPost,
  type PostInput,
} from "@/lib/blog";

type Save = (action: LibraryAction) => Promise<boolean>;
export type BlogLeaveGuard = MutableRefObject<(() => Promise<boolean>) | null>;
const commands: { type: BlogBlock["type"]; label: string; hint: string }[] = [
  { type: "paragraph", label: "Văn bản", hint: "Đoạn văn thông thường" },
  { type: "h1", label: "H1", hint: "Tiêu đề lớn" },
  { type: "h2", label: "H2", hint: "Tiêu đề phần" },
  { type: "h3", label: "H3", hint: "Tiêu đề nhỏ" },
  { type: "h4", label: "H4", hint: "Tiêu đề phụ" },
  { type: "bullet", label: "Gạch đầu dòng", hint: "Danh sách ý tưởng" },
  { type: "number", label: "Đánh số", hint: "Các bước thực hiện" },
  { type: "check", label: "Checklist", hint: "Việc cần làm" },
  { type: "quote", label: "Trích dẫn", hint: "Một điều đáng nhớ" },
  { type: "code", label: "Code", hint: "Đoạn mã" },
  {
    type: "divider",
    label: "Đường phân cách",
    hint: "Chia nội dung thành phần",
  },
  { type: "image", label: "Ảnh", hint: "Tải từ máy của bạn" },
];
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
function listNumber(blocks: BlogBlock[], index: number) {
  let start = index;
  while (start > 0 && blocks[start - 1].type === "number") start--;
  return index - start + 1;
}

function downloadPost(post: PostInput) {
  const url = URL.createObjectURL(
    new Blob([postMarkdown(post)], { type: "text/markdown;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(post.title || "bai-viet").replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").slice(0, 100)}.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function imageData(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)
  )
    throw new Error("Chọn ảnh PNG, JPG, WebP hoặc GIF.");
  if (file.size > 15_000_000) throw new Error("Ảnh gốc tối đa 15 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Không thể xử lý ảnh trên trình duyệt này.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/webp", 0.85);
    if (result.length > 2_000_000)
      throw new Error("Ảnh quá lớn sau khi nén. Hãy chọn ảnh nhỏ hơn.");
    return result;
  } finally {
    bitmap.close();
  }
}

function ReadBlocks({ blocks }: { blocks: BlogBlock[] }) {
  let number = 0;
  return (
    <div className="blog-prose">
      {blocks.map((block) => {
        number = block.type === "number" ? number + 1 : 0;
        const props = { key: block.id, id: `block-${block.id}` };
        switch (block.type) {
          case "h1":
            return (
              <h2 {...props} className="blog-h1">
                <InlineText block={block} />
              </h2>
            );
          case "h2":
            return (
              <h2 {...props}>
                <InlineText block={block} />
              </h2>
            );
          case "h3":
            return (
              <h3 {...props}>
                <InlineText block={block} />
              </h3>
            );
          case "h4":
            return (
              <h4 {...props}>
                <InlineText block={block} />
              </h4>
            );
          case "image":
            return (
              <figure {...props}>
                <img
                  src={block.src}
                  alt={block.text || "Ảnh trong bài viết"}
                  loading="lazy"
                />
                {block.text && <figcaption>{block.text}</figcaption>}
              </figure>
            );
          case "divider":
            return <hr {...props} />;
          case "quote":
            return (
              <blockquote {...props}>
                <InlineText block={block} />
              </blockquote>
            );
          case "code":
            return (
              <pre {...props}>
                <code>{block.text}</code>
              </pre>
            );
          case "bullet":
            return (
              <div {...props} className="blog-list-line">
                <span>•</span>
                <p>
                  <InlineText block={block} />
                </p>
              </div>
            );
          case "number":
            return (
              <div {...props} className="blog-list-line">
                <span>{number}.</span>
                <p>
                  <InlineText block={block} />
                </p>
              </div>
            );
          case "check":
            return (
              <div
                {...props}
                className={`blog-list-line ${block.checked ? "is-checked" : ""}`}
              >
                <input
                  aria-label={block.text || "Mục checklist"}
                  type="checkbox"
                  checked={!!block.checked}
                  readOnly
                  tabIndex={-1}
                />
                <p>
                  <InlineText block={block} />
                </p>
              </div>
            );
          default:
            return (
              <p {...props}>
                <InlineText block={block} />
              </p>
            );
        }
      })}
    </div>
  );
}

function BlogTitle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    if (!ref.current) return;
    ref.current.style.height = "0px";
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }, []);
  useLayoutEffect(resize, [value, resize]);
  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    let width = field.clientWidth;
    let mounted = true;
    const observer = new ResizeObserver(() => {
      if (field.clientWidth !== width) {
        width = field.clientWidth;
        resize();
      }
    });
    observer.observe(field);
    void document.fonts.ready.then(() => {
      if (mounted) resize();
    });
    return () => {
      mounted = false;
      observer.disconnect();
    };
  }, [resize]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className="blog-title-input"
      aria-label="Tiêu đề bài viết"
      placeholder="Chưa đặt tiêu đề"
      value={value}
      maxLength={200}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

type EditorSnapshot = { draft: PostInput; tagText: string };

function PostEditor({
  post,
  onSave,
  onDone,
  guard,
}: {
  post: BlogPost;
  onSave: Save;
  onDone: () => void;
  guard: BlogLeaveGuard;
}) {
  const [draft, setDraft] = useState<PostInput>({
    title: post.title,
    tags: post.tags,
    blocks: post.blocks.length ? post.blocks : [newBlock()],
  });
  const draftRef = useRef(draft);
  const version = useRef<number | null>(
    post.editVersion < 0 ? null : post.editVersion,
  );
  const saved = useRef(post.editVersion < 0 ? "" : JSON.stringify(draft));
  const [saveStatus, setSaveStatus] = useState(
    post.editVersion < 0 ? "Chưa lưu" : "Đã lưu",
  );
  const [saveError, setSaveError] = useState("");
  const [imageError, setImageError] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const imageBusyRef = useRef(false);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const [tagText, setTagText] = useState(post.tags.join(", "));
  const tagTextRef = useRef(tagText);
  const history = useRef(new EditorHistory<EditorSnapshot>());
  const [menu, setMenu] = useState<{
    id: string;
    query: string;
    index: number;
    source?: "slash" | "block";
  } | null>(null);
  const imageTarget = useRef<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const [active, setActive] = useState(draft.blocks[0]?.id);
  const editors = useRef(new Map<string, Editor>());
  const pendingFocus = useRef<{ id: string; position: number } | null>(null);
  const dragging = useRef<string | null>(null);
  const dragEndedAt = useRef(0);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    edge: "before" | "after";
  } | null>(null);

  function applyDraft(next: PostInput, tags = tagTextRef.current) {
    draftRef.current = next;
    tagTextRef.current = tags;
    setTagText(tags);
    setDraft(next);
    setSaveStatus("Chưa lưu");
    setSaveError("");
  }
  function update(next: PostInput, group?: string, tags = tagTextRef.current) {
    const current = draftRef.current;
    if (
      next.title === current.title &&
      next.tags === current.tags &&
      next.blocks === current.blocks &&
      tags === tagTextRef.current
    )
      return;
    history.current.record(
      { draft: current, tagText: tagTextRef.current },
      group,
    );
    applyDraft(next, tags);
  }
  function updateBlock(
    id: string,
    changes: Partial<BlogBlock>,
    group?: string,
  ) {
    update(
      {
        ...draftRef.current,
        blocks: draftRef.current.blocks.map((b) =>
          b.id === id ? { ...b, ...changes } : b,
        ),
      },
      group,
    );
  }
  function restoreHistory(direction: "undo" | "redo") {
    if (imageBusyRef.current) return;
    const current = draftRef.current;
    const previousTags = tagTextRef.current;
    const snapshot = history.current[direction]({
      draft: current,
      tagText: tagTextRef.current,
    });
    if (!snapshot) return;
    setMenu(null);
    setImageError("");
    pendingFocus.current = null;
    applyDraft(snapshot.draft, snapshot.tagText);
    if (
      snapshot.draft.title !== current.title ||
      snapshot.tagText !== previousTags ||
      snapshot.draft.tags !== current.tags
    ) {
      const selector =
        snapshot.draft.title !== current.title
          ? ".blog-title-input"
          : ".blog-tags-input input";
      requestAnimationFrame(() => {
        const field = editorRef.current?.querySelector<
          HTMLInputElement | HTMLTextAreaElement
        >(selector);
        field?.focus();
        field?.setSelectionRange(field.value.length, field.value.length);
      });
    } else {
      const changed = snapshot.draft.blocks.find(
        (b) => b !== current.blocks.find((old) => old.id === b.id),
      );
      const block =
        changed ??
        snapshot.draft.blocks.find((b) => b.id === active) ??
        snapshot.draft.blocks[0];
      if (block) focusBlock(block.id, block.text.length);
    }
  }
  const flush = useCallback(async (): Promise<boolean> => {
    if (imageBusyRef.current) return false;
    if (inFlight.current) return inFlight.current;
    const task = async () => {
      while (saved.current !== JSON.stringify(draftRef.current)) {
        const snapshot = draftRef.current;
        const parsed = postInputSchema.safeParse(snapshot);
        if (!parsed.success) {
          setSaveError(
            parsed.error.issues[0]?.message || "Nội dung vượt quá giới hạn.",
          );
          setSaveStatus("Chưa lưu");
          return false;
        }
        setSaveStatus("Đang lưu…");
        const ok = await saveRef.current({
          type: "save-post",
          id: post.id,
          baseVersion: version.current,
          post: parsed.data,
        });
        if (!mounted.current) return ok;
        if (!ok) {
          setSaveStatus("Chưa lưu");
          setSaveError(
            "Chưa lưu được bài viết. Nội dung đang sửa vẫn được giữ ở đây. Thử lại hoặc xuất Markdown để giữ một bản sao.",
          );
          return false;
        }
        version.current = (version.current ?? -1) + 1;
        saved.current = JSON.stringify(snapshot);
      }
      setSaveStatus("Đã lưu");
      setSaveError("");
      return true;
    };
    const promise = task();
    inFlight.current = promise;
    try {
      return await promise;
    } finally {
      inFlight.current = null;
    }
  }, [post.id]);

  useEffect(() => {
    mounted.current = true;
    guard.current = flush;
    const unload = (event: BeforeUnloadEvent) => {
      if (
        imageBusyRef.current ||
        saved.current !== JSON.stringify(draftRef.current)
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void flush();
      }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("keydown", shortcut);
    return () => {
      mounted.current = false;
      guard.current = null;
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("keydown", shortcut);
    };
  }, [flush, guard]);
  useEffect(() => {
    const timer = setTimeout(() => void flush(), 800);
    return () => clearTimeout(timer);
  }, [draft, flush, imageBusy]);

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (
        !(event.target as Element).closest(
          ".blog-slash-menu, .blog-block-tools, .blog-rich-text",
        )
      )
        setMenu(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, []);
  useEffect(() => {
    editorRef.current
      ?.querySelector(".blog-slash-menu .selected")
      ?.scrollIntoView({ block: "nearest" });
  }, [menu?.index, menu?.query]);
  useEffect(() => {
    if (menu?.source === "block")
      editorRef.current
        ?.querySelector<HTMLButtonElement>(".blog-slash-menu [role=menuitem]")
        ?.focus();
  }, [menu?.id, menu?.source]);

  function openBlockMenu(id: string) {
    history.current.closeGroup();
    setActive(id);
    setMenu(
      menu?.id === id ? null : { id, query: "", index: 0, source: "block" },
    );
  }

  function focusBlock(id: string, position?: number) {
    setActive(id);
    pendingFocus.current = { id, position: position ?? 0 };
    requestAnimationFrame(() => {
      if (pendingFocus.current?.id !== id) return;
      const editor = editors.current.get(id);
      if (editor) {
        editor.commands.focus(
          Math.min((position ?? 0) + 1, editor.state.doc.content.size - 1),
        );
        pendingFocus.current = null;
      } else
        editorRef.current
          ?.querySelector<HTMLInputElement>(`[data-row-id="${id}"] input`)
          ?.focus();
    });
  }
  function insertAfter(id?: string, type: BlogBlock["type"] = "paragraph") {
    const block = newBlock(type);
    const blocks = [...draftRef.current.blocks];
    const index = blocks.findIndex((b) => b.id === id);
    blocks.splice(index < 0 ? blocks.length : index + 1, 0, block);
    update({ ...draftRef.current, blocks });
    focusBlock(block.id, 0);
  }
  function choose(type: BlogBlock["type"], id: string) {
    setMenu(null);
    if (type === "image") {
      imageTarget.current = id;
      imageInput.current?.click();
      return;
    }
    const old = draftRef.current.blocks.find((b) => b.id === id)!;
    const clear =
      (menu?.source !== "block" && old.text.startsWith("/")) ||
      type === "divider";
    const changed = {
      ...old,
      type,
      text: clear ? "" : old.text,
      inline: clear || type === "code" ? undefined : old.inline,
    };
    const trailing = type === "divider" ? newBlock() : null;
    update({
      ...draftRef.current,
      blocks: draftRef.current.blocks.flatMap((b) =>
        b.id === id ? (trailing ? [changed, trailing] : [changed]) : [b],
      ),
    });
    focusBlock(trailing?.id ?? id, 0);
  }
  const filtered = menu
    ? commands.filter((c) =>
        searchText(`${c.label} ${c.hint} ${c.type}`).includes(
          searchText(menu.query),
        ),
      )
    : [];
  function keyDown(
    event: globalThis.KeyboardEvent,
    block: BlogBlock,
    from: number,
    to: number,
  ): boolean {
    if (event.isComposing) return false;
    if (
      [
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(event.key)
    )
      history.current.closeGroup();
    // An explicit key/caret move wins over a pending focus after a block edit.
    if (pendingFocus.current?.id === block.id) pendingFocus.current = null;
    if (menu?.id === block.id) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenu(null);
        return true;
      }
      if (
        (event.key === "ArrowDown" || event.key === "ArrowUp") &&
        filtered.length
      ) {
        event.preventDefault();
        setMenu({
          ...menu,
          index:
            (menu.index +
              (event.key === "ArrowDown" ? 1 : -1) +
              filtered.length) %
            filtered.length,
        });
        return true;
      }
      if (event.key === "Enter" && filtered.length) {
        event.preventDefault();
        choose(filtered[menu.index % filtered.length].type, block.id);
        return true;
      }
    }
    if (event.key === "Enter" && !event.shiftKey && block.type !== "code") {
      event.preventDefault();
      if (!block.text && ["bullet", "number", "check"].includes(block.type)) {
        updateBlock(block.id, { type: "paragraph" });
        return true;
      }
      const next = newBlock(
        ["bullet", "number", "check"].includes(block.type)
          ? block.type
          : "paragraph",
        block.text.slice(to),
      );
      next.inline = sliceInline(block, to);
      const blocks = draftRef.current.blocks.flatMap((b) =>
        b.id === block.id
          ? [
              {
                ...b,
                text: b.text.slice(0, from),
                inline: sliceInline(b, 0, from),
              },
              next,
            ]
          : [b],
      );
      update({ ...draftRef.current, blocks });
      setMenu(null);
      focusBlock(next.id, 0);
      return true;
    } else if (
      event.key === "Backspace" &&
      !block.text &&
      draftRef.current.blocks.length > 1
    ) {
      event.preventDefault();
      const index = draftRef.current.blocks.findIndex((b) => b.id === block.id);
      const previous = draftRef.current.blocks[index === 0 ? 1 : index - 1];
      update({
        ...draftRef.current,
        blocks: draftRef.current.blocks.filter((b) => b.id !== block.id),
      });
      setMenu(null);
      focusBlock(previous.id, previous.text.length);
      return true;
    }
    if (event.key === "Backspace" && from === 0 && to === 0) {
      const index = draftRef.current.blocks.findIndex((b) => b.id === block.id);
      const previous = draftRef.current.blocks[index - 1];
      if (
        previous &&
        !["image", "divider", "code"].includes(previous.type) &&
        block.type !== "code"
      ) {
        event.preventDefault();
        const inline = [
          ...(previous.inline ??
            (previous.text ? [{ text: previous.text }] : [])),
          ...(block.inline ?? [{ text: block.text }]),
        ];
        update({
          ...draftRef.current,
          blocks: draftRef.current.blocks
            .filter((b) => b.id !== block.id)
            .map((b) =>
              b.id === previous.id
                ? {
                    ...b,
                    text: previous.text + block.text,
                    inline: compactInline(inline),
                  }
                : b,
            ),
        });
        focusBlock(previous.id, previous.text.length);
        return true;
      }
    }
    return false;
  }
  async function addImages(
    files: File[],
    target?: string | null,
    edge?: "before" | "after",
  ) {
    if (!files.length || imageBusyRef.current) return;
    imageBusyRef.current = true;
    setImageBusy(true);
    setImageError("");
    setMenu(null);
    try {
      const images: BlogBlock[] = [];
      for (const file of files)
        images.push({ ...newBlock("image"), src: await imageData(file) });
      const blocks = [...draftRef.current.blocks];
      const index = blocks.findIndex((b) => b.id === target);
      const trailing = newBlock();
      if (index >= 0) {
        const replace =
          !edge &&
          blocks[index].type !== "image" &&
          blocks[index].type !== "divider" &&
          (!blocks[index].text || blocks[index].text.startsWith("/"));
        blocks.splice(
          index + (replace || edge === "before" ? 0 : 1),
          replace ? 1 : 0,
          ...images,
          trailing,
        );
      } else blocks.push(...images, trailing);
      const next = { ...draftRef.current, blocks };
      const parsed = postInputSchema.safeParse(next);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      update(next);
      focusBlock(trailing.id, 0);
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : "Không đọc được ảnh.",
      );
    } finally {
      imageBusyRef.current = false;
      setImageBusy(false);
      if (imageInput.current) imageInput.current.value = "";
    }
  }
  function moveBlock(id: string, direction: number) {
    const blocks = [...draftRef.current.blocks];
    const index = blocks.findIndex((b) => b.id === id);
    const next = index + direction;
    if (next < 0 || next >= blocks.length) return;
    [blocks[index], blocks[next]] = [blocks[next], blocks[index]];
    update({ ...draftRef.current, blocks });
  }

  function dropPosition(event: React.DragEvent<HTMLElement>) {
    const row = (event.target as Element).closest<HTMLElement>("[data-row-id]");
    if (!row) return null;
    const bounds = row.getBoundingClientRect();
    return {
      id: row.dataset.rowId!,
      edge:
        event.clientY < bounds.top + bounds.height / 2
          ? ("before" as const)
          : ("after" as const),
    };
  }

  return (
    <section
      className="blog-editor"
      onKeyDownCapture={(event) => {
        if (
          event.nativeEvent.isComposing ||
          event.altKey ||
          !(event.ctrlKey || event.metaKey) ||
          (event.target as Element).closest(".blog-link-form")
        )
          return;
        const key = event.key.toLowerCase();
        if (key === "z" || key === "y") {
          event.preventDefault();
          event.stopPropagation();
          restoreHistory(key === "y" || event.shiftKey ? "redo" : "undo");
        }
      }}
    >
      <div className="blog-actionbar">
        <button
          className="text-button"
          disabled={imageBusy}
          onClick={async () => {
            if (await flush()) onDone();
          }}
        >
          <ArrowLeft size={17} /> Đọc bài viết
        </button>
        <div className="blog-actions">
          <button
            className="icon-button"
            aria-label="Hoàn tác"
            title="Hoàn tác (Ctrl+Z)"
            disabled={!history.current.canUndo || imageBusy}
            onClick={() => restoreHistory("undo")}
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Làm lại"
            title="Làm lại (Ctrl+Y)"
            disabled={!history.current.canRedo || imageBusy}
            onClick={() => restoreHistory("redo")}
          >
            <Redo2 size={17} />
          </button>
          <span
            className={`blog-save-status ${saveError ? "has-error" : ""}`}
            role="status"
          >
            {saveStatus === "Đang lưu…" ? (
              <LoaderCircle size={14} className="spin" />
            ) : saveStatus === "Đã lưu" ? (
              <Check size={14} />
            ) : null}
            {saveStatus}
          </span>
          <button
            className="icon-button"
            aria-label="Xuất bản đang sửa ra Markdown"
            title="Xuất Markdown"
            onClick={() => downloadPost(draftRef.current)}
          >
            <Download size={17} />
          </button>
        </div>
      </div>
      {saveError && (
        <div className="blog-error" role="alert">
          <p>{saveError}</p>
          <button className="text-button" onClick={() => void flush()}>
            Thử lưu lại
          </button>
          <button
            className="text-button"
            onClick={() => {
              if (
                window.confirm(
                  "Bỏ các thay đổi chưa lưu và mở bản trên máy chủ? Bạn có thể xuất Markdown trước để giữ bản đang sửa.",
                )
              )
                onDone();
            }}
          >
            Mở bản đã lưu
          </button>
        </div>
      )}
      <div
        className="blog-paper"
        ref={editorRef}
        onPointerDown={() => {
          pendingFocus.current = null;
          history.current.closeGroup();
        }}
        onPaste={(event) => {
          if (event.defaultPrevented) return;
          const files = Array.from(event.clipboardData.files).filter((f) =>
            f.type.startsWith("image/"),
          );
          if (files.length) {
            event.preventDefault();
            void addImages(files, active);
          }
        }}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files") || dragging.current) {
            event.preventDefault();
            event.dataTransfer.dropEffect = dragging.current ? "move" : "copy";
            setDropTarget(dropPosition(event));
          }
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDropTarget(null);
        }}
        onDrop={(event) => {
          const target = dropPosition(event);
          setDropTarget(null);
          if (dragging.current) {
            event.preventDefault();
            if (target)
              update({
                ...draftRef.current,
                blocks: reorderBlocks(
                  draftRef.current.blocks,
                  dragging.current,
                  target.id,
                  target.edge,
                ),
              });
            dragging.current = null;
            setDragged(null);
            return;
          }
          if (!event.dataTransfer.files.length) return;
          event.preventDefault();
          void addImages(
            Array.from(event.dataTransfer.files),
            target?.id,
            target?.edge,
          );
        }}
      >
        <div className="eyebrow">GHI CHÉP CỦA BẠN</div>
        <BlogTitle
          value={draft.title}
          onChange={(title) => update({ ...draftRef.current, title }, "title")}
        />
        <label className="blog-tags-input">
          <span>TAG</span>
          <input
            aria-label="Tag bài viết"
            placeholder="Thêm tag, cách nhau bằng dấu phẩy…"
            value={tagText}
            maxLength={820}
            onChange={(event) => {
              update(
                {
                  ...draftRef.current,
                  tags: [
                    ...new Set(
                      event.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    ),
                  ],
                },
                "tags",
                event.target.value,
              );
            }}
          />
        </label>
        <div className="blog-writing-hint">
          Bôi đen để định dạng · Gõ <kbd>/</kbd> để chèn · Kéo{" "}
          <GripVertical size={13} /> để sắp xếp
        </div>
        <input
          hidden
          ref={imageInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          onChange={(event) =>
            void addImages(
              Array.from(event.target.files ?? []),
              imageTarget.current,
            )
          }
        />
        {imageError && (
          <div className="blog-error" role="alert">
            {imageError}
            <button
              aria-label="Đóng thông báo"
              onClick={() => setImageError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {draft.blocks.map((block, index) => (
          <div
            key={block.id}
            data-row-id={block.id}
            className={`blog-edit-block ${active === block.id ? "is-active" : ""} ${dragged === block.id ? "is-dragging" : ""} ${dropTarget?.id === block.id ? `drop-${dropTarget.edge}` : ""}`}
          >
            <div className="blog-block-tools">
              <button
                className="blog-drag-handle"
                draggable
                title="Bấm để chọn định dạng · Kéo để sắp xếp"
                aria-label={`Định dạng khối ${index + 1}`}
                aria-haspopup="menu"
                aria-expanded={menu?.id === block.id}
                aria-controls={
                  menu?.id === block.id
                    ? `blog-block-menu-${block.id}`
                    : undefined
                }
                onClick={() => {
                  if (Date.now() - dragEndedAt.current > 250)
                    openBlockMenu(block.id);
                }}
                onDragStart={(event) => {
                  dragging.current = block.id;
                  setDragged(block.id);
                  setMenu(null);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData(
                    "application/x-refsite-block",
                    block.id,
                  );
                  const row =
                    event.currentTarget.closest<HTMLElement>(
                      ".blog-edit-block",
                    );
                  if (row) event.dataTransfer.setDragImage(row, 20, 10);
                }}
                onDragEnd={() => {
                  dragEndedAt.current = Date.now();
                  dragging.current = null;
                  setDragged(null);
                  setDropTarget(null);
                }}
                onKeyDown={(event) => {
                  if (
                    event.altKey &&
                    ["ArrowUp", "ArrowDown"].includes(event.key)
                  ) {
                    event.preventDefault();
                    moveBlock(block.id, event.key === "ArrowUp" ? -1 : 1);
                  }
                }}
              >
                <GripVertical size={16} />
              </button>
              <button
                title="Đổi loại nội dung"
                aria-label={`Đổi loại khối ${index + 1}`}
                onClick={() => openBlockMenu(block.id)}
              >
                <Plus size={15} />
              </button>
              <div
                className="blog-block-more"
                role="group"
                aria-label={`Thao tác khối ${index + 1}`}
              >
                <button
                  title="Di chuyển lên"
                  aria-label={`Di chuyển khối ${index + 1} lên`}
                  disabled={index === 0}
                  onClick={() => moveBlock(block.id, -1)}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  title="Di chuyển xuống"
                  aria-label={`Di chuyển khối ${index + 1} xuống`}
                  disabled={index === draft.blocks.length - 1}
                  onClick={() => moveBlock(block.id, 1)}
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  title="Xoá khối"
                  aria-label={`Xoá khối ${index + 1}`}
                  onClick={() => {
                    update({
                      ...draftRef.current,
                      blocks:
                        draft.blocks.length === 1
                          ? [newBlock()]
                          : draftRef.current.blocks.filter(
                              (b) => b.id !== block.id,
                            ),
                    });
                    setMenu(null);
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
            <div className="blog-block-content">
              {block.type === "image" ? (
                <figure>
                  <img
                    src={block.src}
                    alt={block.text || "Ảnh trong bài viết"}
                    draggable={false}
                  />
                  <input
                    aria-label="Chú thích ảnh"
                    placeholder="Thêm chú thích ảnh…"
                    value={block.text}
                    maxLength={1000}
                    onFocus={() => setActive(block.id)}
                    onChange={(event) =>
                      updateBlock(
                        block.id,
                        { text: event.target.value },
                        `caption:${block.id}`,
                      )
                    }
                  />
                </figure>
              ) : block.type === "divider" ? (
                <hr />
              ) : (
                <div
                  className={`blog-input-line ${block.type === "quote" ? "block-quote" : ""}`}
                >
                  {block.type === "bullet" && (
                    <span className="blog-marker">•</span>
                  )}
                  {block.type === "number" && (
                    <span className="blog-marker">
                      {listNumber(draft.blocks, index)}.
                    </span>
                  )}
                  {block.type === "check" && (
                    <input
                      type="checkbox"
                      aria-label="Đánh dấu hoàn thành"
                      checked={!!block.checked}
                      onChange={(event) =>
                        updateBlock(block.id, { checked: event.target.checked })
                      }
                    />
                  )}
                  <RichBlockText
                    key={block.type === "code" ? "code" : "rich"}
                    block={block}
                    label={
                      commands.find((c) => c.type === block.type)?.label ??
                      "Văn bản"
                    }
                    placeholder={
                      block.type === "paragraph"
                        ? "Viết điều bạn muốn nhớ, hoặc gõ /…"
                        : (commands.find((c) => c.type === block.type)?.hint ??
                          "")
                    }
                    onReady={(editor) => {
                      if (editor) {
                        editors.current.set(block.id, editor);
                        if (pendingFocus.current?.id === block.id) {
                          editor.commands.focus(
                            Math.min(
                              pendingFocus.current.position + 1,
                              editor.state.doc.content.size - 1,
                            ),
                          );
                          pendingFocus.current = null;
                        }
                      } else editors.current.delete(block.id);
                    }}
                    onImages={(files) => void addImages(files, block.id)}
                    onFocus={() => {
                      setActive(block.id);
                      if (menu?.id !== block.id) setMenu(null);
                    }}
                    onChange={(value) => {
                      if (pendingFocus.current?.id === block.id)
                        pendingFocus.current = null;
                      updateBlock(
                        block.id,
                        value,
                        value.text !== block.text
                          ? `text:${block.id}`
                          : undefined,
                      );
                      const text = value.text;
                      setMenu(
                        block.type !== "code" &&
                          text.startsWith("/") &&
                          !text.includes("\n")
                          ? { id: block.id, query: text.slice(1), index: 0 }
                          : null,
                      );
                    }}
                    onKeyDown={(event, from, to) =>
                      keyDown(event, block, from, to)
                    }
                  />
                </div>
              )}
              {menu?.id === block.id && (
                <div
                  className="blog-slash-menu"
                  id={`blog-block-menu-${block.id}`}
                  role="menu"
                  aria-label="Chèn nội dung"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setMenu(null);
                      editorRef.current
                        ?.querySelector<HTMLButtonElement>(
                          `[data-row-id="${block.id}"] .blog-drag-handle`,
                        )
                        ?.focus();
                    } else if (
                      ["ArrowDown", "ArrowUp", "Home", "End"].includes(
                        event.key,
                      ) &&
                      filtered.length
                    ) {
                      event.preventDefault();
                      const index =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? filtered.length - 1
                            : (menu.index +
                                (event.key === "ArrowDown" ? 1 : -1) +
                                filtered.length) %
                              filtered.length;
                      event.currentTarget
                        .querySelectorAll<HTMLButtonElement>("[role=menuitem]")
                        [index]?.focus();
                    }
                  }}
                >
                  <div className="blog-menu-heading">
                    {menu.source === "block"
                      ? "ĐỔI ĐỊNH DẠNG"
                      : "CHÈN NỘI DUNG"}{" "}
                    <button
                      aria-label="Đóng menu nội dung"
                      onClick={() => setMenu(null)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {!filtered.length && <p>Không có loại nội dung phù hợp.</p>}
                  {filtered.map((command, commandIndex) => (
                    <button
                      role="menuitem"
                      key={command.type}
                      className={menu.index === commandIndex ? "selected" : ""}
                      onFocus={() =>
                        setMenu((current) =>
                          current ? { ...current, index: commandIndex } : null,
                        )
                      }
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(command.type, block.id)}
                    >
                      <strong>{command.label}</strong>
                      <span>{command.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="blog-editor-footer">
          <button
            className="text-button"
            onClick={() => insertAfter(draft.blocks.at(-1)?.id)}
          >
            <Plus size={16} /> Thêm dòng
          </button>
          <button
            className="text-button"
            disabled={imageBusy}
            onClick={() => {
              imageTarget.current = active ?? null;
              imageInput.current?.click();
            }}
          >
            {imageBusy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <ImagePlus size={16} />
            )}{" "}
            {imageBusy ? "Đang xử lý ảnh…" : "Thêm ảnh"}
          </button>
          <span>Hoặc kéo thả / dán ảnh vào bài</span>
        </div>
      </div>
    </section>
  );
}

export function BlogView({
  posts,
  onSave,
  guard,
  busy,
}: {
  posts: BlogPost[];
  onSave: Save;
  guard: BlogLeaveGuard;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [trash, setTrash] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [actionError, setActionError] = useState("");
  const post = posts.find((p) => p.id === selected && !p.deletedAt);
  const scope = posts.filter((p) => (trash ? !!p.deletedAt : !p.deletedAt));
  const tags = [...new Set(scope.flatMap((p) => p.tags))].sort((a, b) =>
    a.localeCompare(b),
  );
  const visible = scope
    .filter(
      (p) =>
        (!tag || p.tags.includes(tag)) &&
        searchText(query)
          .trim()
          .split(/\s+/)
          .every((word) =>
            searchText(
              `${p.title} ${p.tags.join(" ")} ${postText(p)}`,
            ).includes(word),
          ),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  function create() {
    const now = new Date().toISOString();
    setEditing({
      id: crypto.randomUUID(),
      title: "",
      tags: [],
      blocks: [newBlock()],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      editVersion: -1,
    });
  }
  async function changeTrash(item: BlogPost) {
    setActionError("");
    if (
      await onSave({
        type: item.deletedAt ? "restore-post" : "trash-post",
        id: item.id,
      })
    )
      setSelected(null);
    else setActionError("Chưa cập nhật được bài viết. Vui lòng thử lại.");
  }
  if (editing)
    return (
      <PostEditor
        key={editing.id}
        post={editing}
        onSave={onSave}
        guard={guard}
        onDone={() => {
          setSelected(editing.id);
          setEditing(null);
        }}
      />
    );
  if (post)
    return (
      <section className="blog-reader">
        <div className="blog-actionbar">
          <button className="text-button" onClick={() => setSelected(null)}>
            <ArrowLeft size={17} /> Tất cả bài viết
          </button>
          <div className="blog-actions">
            <button
              className="icon-button"
              aria-label="Xuất Markdown"
              title="Xuất Markdown"
              onClick={() => downloadPost(post)}
            >
              <Download size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Chuyển bài viết vào thùng rác"
              title="Chuyển vào thùng rác"
              disabled={busy}
              onClick={() => void changeTrash(post)}
            >
              <Trash2 size={17} />
            </button>
            <button
              className="button secondary"
              onClick={() => setEditing(post)}
            >
              <Pencil size={16} /> Chỉnh sửa
            </button>
          </div>
        </div>
        {actionError && (
          <p role="alert" className="blog-error">
            {actionError}
          </p>
        )}
        <article className="blog-paper">
          <div className="eyebrow">GHI CHÉP CỦA BẠN</div>
          <h1 className="blog-post-title">
            {post.title || "Chưa đặt tiêu đề"}
          </h1>
          <div className="blog-meta">
            <span>Cập nhật {dateLabel(post.updatedAt)}</span>
            {post.tags.map((t) => (
              <span className="blog-tag" key={t}>
                {t}
              </span>
            ))}
          </div>
          {post.blocks.filter((b) => /^h[1-4]$/.test(b.type) && b.text)
            .length >= 2 && (
            <details className="blog-toc">
              <summary>Mục lục</summary>
              {post.blocks
                .filter((b) => /^h[1-4]$/.test(b.type) && b.text)
                .map((b) => (
                  <a
                    key={b.id}
                    href={`#block-${b.id}`}
                    style={{ paddingLeft: (Number(b.type[1]) - 1) * 12 }}
                  >
                    {b.text}
                  </a>
                ))}
            </details>
          )}
          <ReadBlocks blocks={post.blocks} />
        </article>
      </section>
    );
  return (
    <section className="blog-home">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> YOUR PERSONAL KNOWLEDGE
          </div>
          <h1>
            Blog<span className="heading-period">.</span>
          </h1>
          <p>Ghi lại điều hay. Tìm lại khi cần.</p>
        </div>
        <button className="button primary" onClick={create}>
          <Plus size={18} /> Viết bài
        </button>
      </div>
      <div className="blog-toolbar">
        <div className="blog-tabs">
          <button
            className={!trash ? "active" : ""}
            onClick={() => {
              setTrash(false);
              setTag("");
            }}
          >
            Bài viết <span>{posts.filter((p) => !p.deletedAt).length}</span>
          </button>
          <button
            className={trash ? "active" : ""}
            onClick={() => {
              setTrash(true);
              setTag("");
            }}
          >
            <Trash2 size={15} /> Thùng rác{" "}
            <span>{posts.filter((p) => p.deletedAt).length}</span>
          </button>
        </div>
        <label className="blog-search">
          <Search size={17} />
          <input
            aria-label="Tìm bài viết"
            placeholder="Tìm trong kiến thức của bạn…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      {!!tags.length && (
        <div className="blog-tag-filter">
          <button className={!tag ? "active" : ""} onClick={() => setTag("")}>
            Tất cả tag
          </button>
          {tags.map((t) => (
            <button
              className={tag === t ? "active" : ""}
              key={t}
              onClick={() => setTag(tag === t ? "" : t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <div className="blog-list-caption">
        <span>
          {visible.length} bài viết{trash ? " trong thùng rác" : ""}
        </span>
        <span>Cập nhật gần nhất</span>
      </div>
      {actionError && (
        <p role="alert" className="blog-error">
          {actionError}
        </p>
      )}
      {visible.length ? (
        <div className="blog-post-list">
          {visible.map((item) => (
            <div key={item.id} className="blog-post-row">
              <button
                className="blog-post-open"
                onClick={() => setSelected(item.id)}
                disabled={trash}
              >
                <span className="blog-post-icon">
                  <BookOpen size={21} />
                </span>
                <div>
                  <h2>{item.title || "Chưa đặt tiêu đề"}</h2>
                  <p>
                    {postText(item).slice(0, 160) ||
                      "Một trang mới, chờ những ý tưởng của bạn."}
                  </p>
                  <div className="blog-meta">
                    <span>{dateLabel(item.updatedAt)}</span>
                    {item.tags.map((t) => (
                      <span className="blog-tag" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
              <div className="blog-row-actions">
                {!trash && (
                  <button
                    className="icon-button"
                    aria-label={`Sửa ${item.title || "bài viết"}`}
                    title="Chỉnh sửa"
                    onClick={() => setEditing(item)}
                  >
                    <Pencil size={16} />
                  </button>
                )}
                <button
                  className="icon-button"
                  aria-label={`${trash ? "Khôi phục" : "Xoá"} ${item.title || "bài viết"}`}
                  title={trash ? "Khôi phục bài viết" : "Chuyển vào thùng rác"}
                  disabled={busy}
                  onClick={() => void changeTrash(item)}
                >
                  {trash ? <RotateCcw size={17} /> : <Trash2 size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="blog-empty">
          <span className="blog-empty-icon">
            {trash ? (
              <Trash2 size={32} strokeWidth={1.3} />
            ) : (
              <BookOpen size={36} strokeWidth={1.3} />
            )}
          </span>
          <h2>
            {query || tag
              ? "Chưa tìm thấy bài viết"
              : trash
                ? "Thùng rác đang trống"
                : "Kiến thức bắt đầu từ một ghi chép"}
          </h2>
          <p>
            {query || tag
              ? "Thử từ khoá hoặc tag khác để tìm lại bài viết."
              : trash
                ? "Bài viết đã xoá sẽ nằm ở đây để bạn có thể khôi phục."
                : "Một ý tưởng, một bài học, một điều vừa khám phá.\nViết lại và giữ cho riêng bạn."}
          </p>
          {!trash && !query && !tag && (
            <button className="button primary" onClick={create}>
              <Plus size={17} /> Viết bài đầu tiên
            </button>
          )}
        </div>
      )}
      <footer className="blog-footer">
        <span className="connection-dot" /> Chỉ dành cho bạn · Tự động lưu khi
        soạn thảo
      </footer>
    </section>
  );
}
