
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import EditorToolbar from "./EditorToolbar";

function TextEditor({ onUpdate, initialContent }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        italic: {
          HTMLAttributes: {
            class: "editor-italic",
          },
        },
      }),
    ],

    content: initialContent || {
      type: "doc",
      content: [{ type: "paragraph" }],
    },

    onUpdate: ({ editor }) => {
      onUpdate(editor.getJSON());
    },

    editorProps: {
      attributes: {
        class: "tiptap-editor",
        spellcheck: "true",
        "aria-label": "Document editor",
      },
    },
  });

  useEffect(() => {
    if (editor && initialContent) {
      editor.commands.setContent(initialContent, {
        emitUpdate: false,
      });
    }
  }, [editor, initialContent]);

  return (
    <div className="editor-wrapper">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

export default TextEditor;
