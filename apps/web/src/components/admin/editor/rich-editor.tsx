"use client";

import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import Youtube from "@tiptap/extension-youtube";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Underline,
  Undo2,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { BlogMediaDto } from "@fitr8/contracts";
import { cn } from "@/lib/cn";
import { ImagePicker } from "../image-picker";

export interface RichEditorChange {
  json: Record<string, unknown>;
  html: string;
}

/**
 * The post body: a Tiptap editor whose HTML matches what /blog renders (same `blog-prose` styles).
 * The API sanitises the HTML before storing it.
 */
export function RichEditor({
  initial,
  editable,
  onChange,
}: {
  /** A Tiptap document, or HTML (posts created through the API). */
  initial: Record<string, unknown> | string;
  editable: boolean;
  onChange: (change: RichEditorChange) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Image.configure({ inline: false }),
      TableKit.configure({ table: { resizable: false } }),
      Youtube.configure({ nocookie: true, modestBranding: true }),
      Placeholder.configure({ placeholder: "Start writing. Use H2 for sections, H3 inside them." }),
    ],
    content: initial,
    editorProps: { attributes: { class: "blog-prose", "aria-label": "Post body" } },
    onUpdate: ({ editor: e }) =>
      onChange({ json: e.getJSON() as Record<string, unknown>, html: e.getHTML() }),
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  return (
    <div className="rounded-card border border-line bg-surface">
      {editor && editable && <Toolbar editor={editor} />}
      <div className="px-5 py-6 sm:px-8">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const [picking, setPicking] = useState(false);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      link: e.isActive("link"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      image: e.isActive("image"),
      table: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  function setLink() {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(
      "Link URL (https://… or /blog/…). Leave empty to remove.",
      prev ?? "https://",
    );
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://")
      return chain().extendMarkRange("link").unsetLink().run();
    const href = url.trim();
    const external = /^https?:\/\//.test(href) && !/fitr8\.com/.test(href);
    chain()
      .extendMarkRange("link")
      .setLink({ href, target: external ? "_blank" : null })
      .run();
  }

  function insertImage(m: BlogMediaDto) {
    chain()
      .setImage({ src: m.url, alt: m.alt ?? "" })
      .run();
  }

  function editAlt() {
    const alt = window.prompt(
      "Alt text for this image:",
      (editor.getAttributes("image").alt as string) ?? "",
    );
    if (alt !== null) chain().updateAttributes("image", { alt: alt.trim() }).run();
  }

  function insertVideo() {
    const src = window.prompt("YouTube link:");
    if (src?.trim()) chain().setYoutubeVideo({ src: src.trim() }).run();
  }

  const groups: {
    label: string;
    icon: LucideIcon;
    on?: boolean;
    run: () => void;
    disabled?: boolean;
  }[][] = [
    [
      {
        label: "Heading",
        icon: Heading2,
        on: s.h2,
        run: () => chain().toggleHeading({ level: 2 }).run(),
      },
      {
        label: "Subheading",
        icon: Heading3,
        on: s.h3,
        run: () => chain().toggleHeading({ level: 3 }).run(),
      },
    ],
    [
      { label: "Bold", icon: Bold, on: s.bold, run: () => chain().toggleBold().run() },
      { label: "Italic", icon: Italic, on: s.italic, run: () => chain().toggleItalic().run() },
      {
        label: "Underline",
        icon: Underline,
        on: s.underline,
        run: () => chain().toggleUnderline().run(),
      },
      {
        label: "Strikethrough",
        icon: Strikethrough,
        on: s.strike,
        run: () => chain().toggleStrike().run(),
      },
      { label: "Link", icon: Link2, on: s.link, run: setLink },
    ],
    [
      {
        label: "Bulleted list",
        icon: List,
        on: s.bullet,
        run: () => chain().toggleBulletList().run(),
      },
      {
        label: "Numbered list",
        icon: ListOrdered,
        on: s.ordered,
        run: () => chain().toggleOrderedList().run(),
      },
      { label: "Quote", icon: Quote, on: s.quote, run: () => chain().toggleBlockquote().run() },
      { label: "Code block", icon: Code2, on: s.code, run: () => chain().toggleCodeBlock().run() },
      { label: "Divider", icon: Minus, run: () => chain().setHorizontalRule().run() },
    ],
    [
      { label: "Image", icon: ImageIcon, run: () => setPicking(true) },
      {
        label: "Table",
        icon: TableIcon,
        on: s.table,
        run: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      },
      { label: "YouTube video", icon: Video, run: insertVideo },
    ],
    [
      { label: "Undo", icon: Undo2, run: () => chain().undo().run(), disabled: !s.canUndo },
      { label: "Redo", icon: Redo2, run: () => chain().redo().run(), disabled: !s.canRedo },
    ],
  ];

  const pill =
    "inline-flex h-8 items-center rounded-[10px] px-2.5 text-[13px] font-semibold text-ink-2 hover:bg-sunken";

  return (
    <div className="sticky top-14 z-20 rounded-t-card border-b border-line bg-surface/95 backdrop-blur lg:top-0">
      <div
        className="flex flex-wrap items-center gap-1 px-2 py-1.5"
        role="toolbar"
        aria-label="Formatting"
      >
        {groups.map((g, i) => (
          <div
            key={i}
            className={cn("flex items-center gap-0.5", i > 0 && "border-l border-line pl-1")}
          >
            {g.map(({ label, icon: Icon, on, run, disabled }) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={on}
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={run}
                className={cn(
                  "grid size-9 place-items-center rounded-[10px] transition-colors disabled:opacity-35",
                  on ? "bg-brand/10 text-brand" : "text-ink-2 hover:bg-sunken",
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
              </button>
            ))}
          </div>
        ))}
      </div>
      {(s.image || s.table) && (
        <div className="flex flex-wrap gap-1 border-t border-line px-2 py-1.5">
          {s.image && (
            <button type="button" className={pill} onClick={editAlt}>
              Edit alt text
            </button>
          )}
          {s.table && (
            <>
              <button type="button" className={pill} onClick={() => chain().addRowAfter().run()}>
                + Row
              </button>
              <button type="button" className={pill} onClick={() => chain().addColumnAfter().run()}>
                + Column
              </button>
              <button type="button" className={pill} onClick={() => chain().deleteRow().run()}>
                − Row
              </button>
              <button type="button" className={pill} onClick={() => chain().deleteColumn().run()}>
                − Column
              </button>
              <button
                type="button"
                className={pill}
                onClick={() => chain().toggleHeaderRow().run()}
              >
                Header row
              </button>
              <button
                type="button"
                className={cn(pill, "text-fat")}
                onClick={() => chain().deleteTable().run()}
              >
                Delete table
              </button>
            </>
          )}
        </div>
      )}
      <ImagePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={insertImage}
        title="Insert an image"
      />
    </div>
  );
}
