"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  Mark,
  Node,
  type Editor,
  type EditorOptions,
  type JSONContent,
} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Fragment, Slice, type Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Highlighter,
  Link,
  Unlink,
  X,
} from "lucide-react";
import { safeBlogLink, type BlogBlock, type BlogInline } from "@/lib/blog";
import { compactInline } from "@/lib/blog-editor";

const markNames = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "highlight",
] as const;
const SingleBlock = Node.create({
  name: "doc",
  topNode: true,
  content: "paragraph",
});
const Highlight = Mark.create({
  name: "highlight",
  parseHTML: () => [{ tag: "mark" }],
  renderHTML: () => ["mark", {}, 0],
});

function toDocument(block: BlogBlock): JSONContent {
  const parts =
    block.type === "code"
      ? [{ text: block.text }]
      : (block.inline ?? [{ text: block.text }]);
  const content: JSONContent[] = [];
  for (const part of parts) {
    const marks: NonNullable<JSONContent["marks"]> = markNames
      .filter((name) => part[name])
      .map((type) => ({ type }));
    if (part.href) marks.push({ type: "link", attrs: { href: part.href } });
    part.text.split("\n").forEach((text, index) => {
      if (index) content.push({ type: "hardBreak", marks });
      if (text) content.push({ type: "text", text, marks });
    });
  }
  return { type: "doc", content: [{ type: "paragraph", content }] };
}

function fromDocument(editor: Editor, code: boolean) {
  const inline: BlogInline[] = [];
  editor.state.doc.descendants((node) => {
    if (!node.isText && node.type.name !== "hardBreak") return;
    const part: BlogInline = { text: node.isText ? node.text! : "\n" };
    if (!code)
      for (const mark of node.marks) {
        if (markNames.includes(mark.type.name as (typeof markNames)[number]))
          part[mark.type.name as (typeof markNames)[number]] = true;
        if (mark.type.name === "link" && safeBlogLink(mark.attrs.href))
          part.href = mark.attrs.href;
      }
    inline.push(part);
  });
  return {
    text: inline.map((part) => part.text).join(""),
    inline: code ? undefined : compactInline(inline),
  };
}

export function InlineText({ block }: { block: BlogBlock }) {
  if (!block.text) return "\u00a0";
  if (!block.inline || block.type === "code") return block.text || "\u00a0";
  return block.inline.map((part, index) => {
    let content: ReactNode = part.text;
    if (part.code) content = <code>{content}</code>;
    if (part.bold) content = <strong>{content}</strong>;
    if (part.italic) content = <em>{content}</em>;
    if (part.underline) content = <u>{content}</u>;
    if (part.strike) content = <s>{content}</s>;
    if (part.highlight) content = <mark>{content}</mark>;
    if (part.href && safeBlogLink(part.href))
      content = (
        <a href={part.href} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      );
    return <span key={index}>{content}</span>;
  });
}

type Props = {
  block: BlogBlock;
  label: string;
  placeholder: string;
  onChange: (value: Pick<BlogBlock, "text" | "inline">) => void;
  onKeyDown: (event: KeyboardEvent, from: number, to: number) => boolean;
  onFocus: () => void;
  onImages: (files: File[]) => void;
  onReady: (editor: Editor | null) => void;
};

export function RichBlockText(props: Props) {
  const callbacks = useRef(props);
  callbacks.current = props;
  const wrapper = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<Editor | null>(null);
  const [selection, setSelection] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const [linkError, setLinkError] = useState("");
  const code = props.block.type === "code";
  function showSelection(editor: Editor) {
    const { from, to } = editor.state.selection;
    if (from === to || !editor.isFocused || code || !wrapper.current) {
      setSelection(null);
      return;
    }
    const coords = editor.view.coordsAtPos(from);
    const bounds = wrapper.current.getBoundingClientRect();
    setSelection({
      left: Math.max(
        0,
        Math.min(coords.left - bounds.left, bounds.width - 300),
      ),
      top: coords.top - bounds.top - 46,
    });
  }
  // Keep view options stable: updating them on every React render can restore a
  // stale ProseMirror selection before native caret movement is processed.
  const options = useMemo<Partial<EditorOptions>>(
    () => ({
      extensions: [
        SingleBlock,
        Highlight,
        StarterKit.configure({
          undoRedo: false,
          document: false,
          heading: false,
          blockquote: false,
          codeBlock: false,
          bulletList: false,
          orderedList: false,
          listItem: false,
          listKeymap: false,
          horizontalRule: false,
          trailingNode: false,
          dropcursor: false,
          gapcursor: false,
          bold: code ? false : {},
          italic: code ? false : {},
          underline: code ? false : {},
          strike: code ? false : {},
          code: code ? false : {},
          link: code
            ? false
            : {
                openOnClick: false,
                autolink: true,
                defaultProtocol: "https",
                isAllowedUri: safeBlogLink,
              },
        }),
      ],
      content: toDocument(props.block),
      editorProps: {
        attributes: {
          role: "textbox",
          "aria-multiline": "true",
          "aria-label": `${props.label} — nội dung`,
        },
        handleKeyDown: (_view, event) => {
          if (event.isComposing || _view.composing) return false;
          // Native Home/End/arrow movement can precede the asynchronous
          // selectionchange event. Read the visible caret before splitting or
          // inserting a hard break so fast typing never uses a stale selection.
          const selection = _view.dom.ownerDocument.getSelection();
          if (
            selection?.anchorNode &&
            selection.focusNode &&
            _view.dom.contains(selection.anchorNode) &&
            _view.dom.contains(selection.focusNode)
          ) {
            const anchor = _view.posAtDOM(
              selection.anchorNode,
              selection.anchorOffset,
            );
            const head = _view.posAtDOM(
              selection.focusNode,
              selection.focusOffset,
            );
            if (
              anchor !== _view.state.selection.anchor ||
              head !== _view.state.selection.head
            ) {
              _view.dispatch(
                _view.state.tr.setSelection(
                  TextSelection.create(_view.state.doc, anchor, head),
                ),
              );
            }
          }
          if (
            callbacks.current.onKeyDown(
              event,
              _view.state.selection.from - 1,
              _view.state.selection.to - 1,
            )
          )
            return true;
          if (event.key === "Enter") {
            editorInstance.current?.commands.setHardBreak();
            return true;
          }
          return false;
        },
        handlePaste: (_view, event) => {
          const files = Array.from(event.clipboardData?.files ?? []).filter(
            (file) => file.type.startsWith("image/"),
          );
          if (!files.length) return false;
          event.preventDefault();
          event.stopPropagation();
          callbacks.current.onImages(files);
          return true;
        },
        handleDrop: (_view, event) => {
          // The outer block list owns image drops and block reordering.
          if (
            event.dataTransfer?.files.length ||
            event.dataTransfer?.types.includes("application/x-refsite-block")
          )
            return true;
          return false;
        },
        transformPasted: (slice) => {
          const nodes: PMNode[] = [];
          slice.content.forEach((node, _offset, index) => {
            if (index && node.isBlock)
              nodes.push(
                editorInstance.current!.schema.nodes.hardBreak.create(),
              );
            if (node.isInline) nodes.push(node);
            else
              node.descendants((child) => {
                if (child.isInline) {
                  nodes.push(child);
                  return false;
                }
              });
          });
          return new Slice(Fragment.from(nodes), 0, 0);
        },
      },
      onUpdate: ({ editor }) => {
        callbacks.current.onChange(fromDocument(editor, code));
        showSelection(editor);
      },
      onSelectionUpdate: ({ editor }) => {
        setLinkOpen(false);
        showSelection(editor);
      },
      onFocus: ({ editor }) => {
        callbacks.current.onFocus();
        showSelection(editor);
      },
      onBlur: ({ event }) => {
        if (
          !wrapper.current?.contains(
            event.relatedTarget as globalThis.Node | null,
          )
        ) {
          setSelection(null);
          setLinkOpen(false);
        }
      },
    }),
    [code],
  );
  const editor = useEditor({ ...options, immediatelyRender: false });
  editorInstance.current = editor;

  useEffect(() => {
    if (!editor) return;
    callbacks.current.onReady(editor);
    return () => callbacks.current.onReady(null);
  }, [editor]);
  useEffect(() => {
    editor?.view.dom.setAttribute("aria-label", `${props.label} — nội dung`);
  }, [editor, props.label]);
  useEffect(() => {
    if (!editor) return;
    const expected = editor.schema.nodeFromJSON(toDocument(props.block));
    if (!editor.state.doc.eq(expected)) {
      editor.commands.setContent(toDocument(props.block), {
        emitUpdate: false,
      });
    }
  }, [editor, props.block.text, props.block.inline, code]);

  const buttons = [
    { mark: "bold", label: "In đậm", icon: Bold },
    { mark: "italic", label: "In nghiêng", icon: Italic },
    { mark: "underline", label: "Gạch chân", icon: Underline },
    { mark: "strike", label: "Gạch ngang", icon: Strikethrough },
    { mark: "code", label: "Mã trong dòng", icon: Code },
    { mark: "highlight", label: "Tô sáng", icon: Highlighter },
  ];
  return (
    <div
      ref={wrapper}
      className={`blog-rich-text block-${props.block.type}`}
      data-block-id={props.block.id}
      data-empty={!props.block.text}
      data-placeholder={props.placeholder}
    >
      <EditorContent editor={editor} />
      {selection && editor && (
        <div className="blog-format-popover" style={selection}>
          <div
            role="toolbar"
            aria-label="Định dạng văn bản"
            className="blog-format-toolbar"
            onMouseDown={(event) => event.preventDefault()}
          >
            {buttons.map(({ mark, label, icon: Icon }) => (
              <button
                key={mark}
                type="button"
                aria-label={label}
                title={label}
                aria-pressed={editor.isActive(mark)}
                onClick={() => {
                  editor.chain().focus().toggleMark(mark).run();
                  showSelection(editor);
                }}
              >
                <Icon size={16} />
              </button>
            ))}
            <button
              type="button"
              aria-label="Chèn liên kết"
              title="Chèn liên kết"
              aria-pressed={editor.isActive("link")}
              onClick={() => {
                setHref(editor.getAttributes("link").href ?? "");
                setLinkError("");
                setLinkOpen(!linkOpen);
              }}
            >
              <Link size={16} />
            </button>
            {editor.isActive("link") && (
              <button
                type="button"
                aria-label="Bỏ liên kết"
                title="Bỏ liên kết"
                onClick={() => editor.chain().focus().unsetLink().run()}
              >
                <Unlink size={16} />
              </button>
            )}
          </div>
          {linkOpen && (
            <form
              className="blog-link-form"
              onSubmit={(event) => {
                event.preventDefault();
                const value = href.trim();
                const url = /^[a-z][a-z\d+.-]*:/i.test(value)
                  ? value
                  : `https://${value}`;
                if (!value || url.length > 2000 || !safeBlogLink(url)) {
                  setLinkError("Nhập liên kết http, https hoặc mailto hợp lệ.");
                  return;
                }
                editor.chain().focus().setLink({ href: url }).run();
                setLinkOpen(false);
              }}
            >
              <input
                autoFocus
                aria-label="Địa chỉ liên kết"
                placeholder="https://example.com"
                value={href}
                maxLength={2000}
                onChange={(event) => setHref(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setLinkOpen(false);
                    editor.commands.focus();
                  }
                }}
              />
              <button type="submit">Áp dụng</button>
              <button
                type="button"
                aria-label="Đóng liên kết"
                onClick={() => {
                  setLinkOpen(false);
                  editor.commands.focus();
                }}
              >
                <X size={15} />
              </button>
              {linkError && <span role="alert">{linkError}</span>}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
