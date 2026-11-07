
import { useState } from "react";

import {
  FileText,
  Lock,
  MoreVertical,
  Trash2,
  ExternalLink,
} from "lucide-react";

function FileCard({ file, onOpen, onDelete, deleting }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="file-card"
      onClick={() => onOpen(file)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(file);
        }
      }}
    >
      <div className="file-icon">
        <FileText size={24} />
      </div>

      <div className="file-details">
        <h3>{file.title || "Untitled Document"}</h3>

        <p>
          Modified:{" "}
          {file.updated_at
            ? new Date(file.updated_at).toLocaleString()
            : "Unknown"}
        </p>
      </div>

      <div className="file-actions">
        <Lock size={16} className="lock-icon" />

        <div className="file-menu-wrapper">
          <button
            className="icon-button"
            type="button"
            aria-label="Document options"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((previous) => !previous);
            }}
          >
            <MoreVertical size={20} />
          </button>

          {menuOpen && (
            <div
              className="file-dropdown"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpen(file);
                }}
              >
                <ExternalLink size={16} />
                Open document
              </button>

              <button
                type="button"
                className="delete-menu-item"
                disabled={deleting}
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(file);
                }}
              >
                <Trash2 size={16} />
                {deleting ? "Deleting..." : "Delete document"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FileCard;
