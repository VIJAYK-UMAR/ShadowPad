
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Navbar from "../components/Navbar";
import FileCard from "../components/FileCard";

import {
  Plus,
  FileText,
  ShieldCheck,
  LockKeyhole,
} from "lucide-react";

import { supabase } from "../lib/supabase";

function Dashboard() {
  const navigate = useNavigate();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  async function fetchDocuments() {
    try {
      setLoading(true);
      setError("");

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;

      if (!userData.user) {
        throw new Error("Please log in to view your documents.");
      }

      const { data, error: fetchError } = await supabase
        .from("documents")
        .select("id, title, updated_at")
        .order("updated_at", { ascending: false });

      if (fetchError) throw fetchError;

      setFiles(data || []);
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError(err.message || "Unable to load documents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDocuments();
  }, []);

  function createFile() {
    navigate("/editor");
  }

  function openFile(file) {
    navigate("/editor", {
      state: {
        documentId: file.id,
      },
    });
  }

  async function deleteFile(file) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${file.title || "Untitled Document"}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(file.id);
      setError("");

      const { error: deleteError } = await supabase
        .from("documents")
        .delete()
        .eq("id", file.id);

      if (deleteError) throw deleteError;

      setFiles((previousFiles) =>
        previousFiles.filter((item) => item.id !== file.id)
      );
    } catch (err) {
      console.error("Document deletion error:", err);

      setError(
        err.message || "Unable to delete this document."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="dashboard-page">
      <Navbar />

      <main className="dashboard-container">
        <section className="welcome-section">
          <div>
            <h1>Your private workspace</h1>
            <p>Write, organize and protect your thoughts.</p>
          </div>

          <button
            className="primary-button new-file-button"
            onClick={createFile}
          >
            <Plus size={18} />
            New document
          </button>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <FileText size={22} />
            <div>
              <h2>{loading ? "..." : files.length}</h2>
              <p>Total documents</p>
            </div>
          </div>

          <div className="stat-card">
            <LockKeyhole size={22} />
            <div>
              <h2>{loading ? "..." : files.length}</h2>
              <p>Protected documents</p>
            </div>
          </div>

          <div className="stat-card">
            <ShieldCheck size={22} />
            <div>
              <h2>{error ? "Error" : "Active"}</h2>
              <p>Workspace status</p>
            </div>
          </div>
        </section>

        <section className="documents-section">
          <div className="section-heading">
            <div>
              <h2>My documents</h2>
              <p>Your private collection</p>
            </div>
          </div>

          {error && (
            <p className="save-error">{error}</p>
          )}

          <div className="file-list">
            {loading ? (
              <p className="empty-message">
                Loading your documents...
              </p>
            ) : files.length > 0 ? (
              files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onOpen={openFile}
                  onDelete={deleteFile}
                  deleting={deletingId === file.id}
                />
              ))
            ) : (
              <p className="empty-message">
                You haven't saved any documents yet.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
