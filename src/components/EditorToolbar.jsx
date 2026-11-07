
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Undo2,
  Redo2,
} from "lucide-react";

function EditorToolbar({ editor }) {
  if (!editor) return null;

  const buttons = [
    {
      label: "Bold",
      icon: <Bold size={18} />,
      action: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive("bold"),
    },
    {
      label: "Italic",
      icon: <Italic size={18} />,
      action: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive("italic"),
    },
    {
      label: "Underline",
      icon: <Underline size={18} />,
      action: () => editor.chain().focus().toggleUnderline().run(),
      active: editor.isActive("underline"),
    },
    {
      label: "Heading 1",
      icon: <Heading1 size={18} />,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      active: editor.isActive("heading", { level: 1 }),
    },
    {
      label: "Heading 2",
      icon: <Heading2 size={18} />,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive("heading", { level: 2 }),
    },
    {
      label: "Heading 3",
      icon: <Heading3 size={18} />,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: editor.isActive("heading", { level: 3 }),
    },
    {
      label: "Bullet list",
      icon: <List size={18} />,
      action: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive("bulletList"),
    },
    {
      label: "Numbered list",
      icon: <ListOrdered size={18} />,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive("orderedList"),
    },
  ];

  return (
    <div className="editor-toolbar">
      {buttons.map((button) => (
        <button
          key={button.label}
          type="button"
          title={button.label}
          aria-label={button.label}
          className={`toolbar-button ${button.active ? "active" : ""}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={button.action}
        >
          {button.icon}
        </button>
      ))}

      <div className="toolbar-divider" />

      <button
        type="button"
        className="toolbar-button"
        title="Undo"
        aria-label="Undo"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
      >
        <Undo2 size={18} />
      </button>

      <button
        type="button"
        className="toolbar-button"
        title="Redo"
        aria-label="Redo"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
      >
        <Redo2 size={18} />
      </button>
    </div>
  );
}

export default EditorToolbar;
