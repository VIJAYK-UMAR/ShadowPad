
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import {
  ArrowLeft,
  LockKeyhole,
  FileText,
  Save,
  Copy,
  Download,
  ShieldCheck,
  KeyRound,
} from "lucide-react";

import TextEditor from "../components/TextEditor";
import { supabase } from "../lib/supabase";

import {
  generateRecoveryKey,
  encryptDocument,
  decryptDocument,
  updateEncryptedDocument,
  recoverDocument,
  changeDocumentPassword,
  resetDocumentPasswordWithRecoveryKey,
} from "../lib/crypto";

function Editor() {
  const navigate = useNavigate();
  const location = useLocation();

  const documentId = location.state?.documentId;

  const loadedDocumentRef = useRef(null);
  const editVersionRef = useRef(0);
  const failedVersionRef = useRef(-1);

  const [activeDocumentId, setActiveDocumentId] = useState(
    documentId || null
  );

  const [title, setTitle] = useState("Untitled Document");
  const [content, setContent] = useState(null);
  const [editorInitialContent, setEditorInitialContent] = useState(null);

  const [existingRow, setExistingRow] = useState(null);
  const [documentPassword, setDocumentPassword] = useState("");

  const [loadingDocument, setLoadingDocument] = useState(
    Boolean(documentId)
  );

  const [documentError, setDocumentError] = useState("");

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Allows the user to manually retry a failed autosave.
  const [saveRetryToken, setSaveRetryToken] = useState(0);

  const [pendingSave, setPendingSave] = useState(null);

  // In-app dialog state.
  const [dialog, setDialog] = useState(null);

  const [dialogValues, setDialogValues] = useState({
    password: "",
    confirmPassword: "",
    recoveryKey: "",
  });

  const [dialogError, setDialogError] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);

  const [feedbackMessage, setFeedbackMessage] = useState("");

  const [rowToOpen, setRowToOpen] = useState(null);
  const [recoveredDocument, setRecoveredDocument] = useState(null);

  const wordCount = countWords(content);

  // Load an existing encrypted document.
  useEffect(() => {
    if (!documentId) {
      loadedDocumentRef.current = null;

      setActiveDocumentId(null);
      setTitle("Untitled Document");
      setContent(null);
      setEditorInitialContent(null);
      setExistingRow(null);
      setDocumentPassword("");
      setLoadingDocument(false);
      setDocumentError("");
      setIsDirty(false);
      setSaved(false);
      setSaveError("");
      setPendingSave(null);
      setDialog(null);
      setRowToOpen(null);
      setRecoveredDocument(null);

      return;
    }

    if (loadedDocumentRef.current === documentId) {
      return;
    }

    loadedDocumentRef.current = documentId;

    let cancelled = false;

    async function loadDocument() {
      try {
        setLoadingDocument(true);
        setDocumentError("");

        const { data: row, error } = await supabase
          .from("documents")
          .select("*")
          .eq("id", documentId)
          .single();

        if (error) throw error;
        if (cancelled) return;

        setRowToOpen(row);

        setDialogValues({
          password: "",
          confirmPassword: "",
          recoveryKey: "",
        });

        setDialogError("");
        setDialog({ type: "choose-open" });
      } catch (error) {
        if (!cancelled) {
          console.error("Document loading failed:", error);

          setDocumentError(
            error.message || "Could not load this document."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingDocument(false);
        }
      }
    }

    loadDocument();

    return () => {
      cancelled = true;

      if (loadedDocumentRef.current === documentId) {
        loadedDocumentRef.current = null;
      }
    };
  }, [documentId]);

  // Load successfully decrypted content into the editor.
  function finishOpeningDocument(activeRow, decrypted, password) {
    setTitle(
      activeRow.title || decrypted.title || "Untitled Document"
    );

    setContent(decrypted.content);
    setEditorInitialContent(decrypted.content);

    setExistingRow(activeRow);
    setDocumentPassword(password);
    setActiveDocumentId(activeRow.id);

    editVersionRef.current = 0;
    failedVersionRef.current = -1;

    setIsDirty(false);
    setSaved(true);

    setRowToOpen(null);
    setRecoveredDocument(null);
    setDialog(null);

    setDialogValues({
      password: "",
      confirmPassword: "",
      recoveryKey: "",
    });

    setDialogError("");
  }

  // Open a particular dialog.
  function openDialog(type) {
    setDialogError("");

    setDialogValues({
      password: "",
      confirmPassword: "",
      recoveryKey: "",
    });

    setDialog({ type });
  }

  // Close a dialog.
  
  function closeDialog() {
    if (dialogBusy) return;

    // Clear sensitive form values.
    setDialogValues({
      password: "",
      confirmPassword: "",
      recoveryKey: "",
    });

    setDialogError("");
    setRecoveredDocument(null);

    if (
      dialog?.type === "choose-open" ||
      dialog?.type === "document-password" ||
      dialog?.type === "recovery-key" ||
      dialog?.type === "recovery-new-password"
    ) {
      navigate("/dashboard", { replace: true });
      return;
    }

    setDialog(null);
  }

  // Handle dialog form submission.
  async function handleDialogSubmit(event) {
    event.preventDefault();

    if (!dialog || dialogBusy) return;

    setDialogBusy(true);
    setDialogError("");

    try {
      // Open using document password.
      if (dialog.type === "document-password") {
        const password = dialogValues.password;

        if (!password) {
          throw new Error("Enter the document password.");
        }

        const decrypted = await decryptDocument(
          rowToOpen,
          password
        );

        finishOpeningDocument(
          rowToOpen,
          decrypted,
          password
        );
      }

      // Open using recovery key.
      else if (dialog.type === "recovery-key") {
        const recoveryKey = dialogValues.recoveryKey.trim();

        if (!recoveryKey) {
          throw new Error("Enter your recovery key.");
        }

        const decrypted = await recoverDocument(
          rowToOpen,
          recoveryKey
        );

        setRecoveredDocument({
          decrypted,
          recoveryKey,
        });

        setDialogValues({
          password: "",
          confirmPassword: "",
          recoveryKey,
        });

        setDialog({ type: "recovery-new-password" });
      }

      // Set a new password after recovery.
      else if (dialog.type === "recovery-new-password") {
        const {
          password,
          confirmPassword,
          recoveryKey,
        } = dialogValues;

        if (password.length < 8) {
          throw new Error(
            "New password must contain at least 8 characters."
          );
        }

        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const passwordFields =
          await resetDocumentPasswordWithRecoveryKey(
            rowToOpen,
            recoveryKey,
            password
          );

        const { data: updatedRow, error } = await supabase
          .from("documents")
          .update(passwordFields)
          .eq("id", rowToOpen.id)
          .select("*")
          .single();

        if (error) throw error;

        finishOpeningDocument(
          updatedRow,
          recoveredDocument.decrypted,
          password
        );

        setFeedbackMessage(
          "Document recovered and new password saved successfully."
        );
      }

      // Create password for a new document.
      else if (dialog.type === "create-document-password") {
        const { password, confirmPassword } = dialogValues;

        if (password.length < 8) {
          throw new Error(
            "Password must contain at least 8 characters."
          );
        }

        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const recoveryKey = generateRecoveryKey();

        const documentContent = content || {
          type: "doc",
          content: [{ type: "paragraph" }],
        };

        const encrypted = await encryptDocument({
          title: title.trim(),
          content: documentContent,
          password,
          recoveryKey,
        });

        setPendingSave({
          encrypted,
          password,
          recoveryKey,
        });

        setDialog(null);

        setDialogValues({
          password: "",
          confirmPassword: "",
          recoveryKey: "",
        });
      }

      // Change existing document password.
      else if (dialog.type === "change-document-password") {
        const { password, confirmPassword } = dialogValues;

        if (password.length < 8) {
          throw new Error(
            "New password must contain at least 8 characters."
          );
        }

        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const passwordFields = await changeDocumentPassword(
          existingRow,
          documentPassword,
          password
        );

        const { data: updatedRow, error } = await supabase
          .from("documents")
          .update(passwordFields)
          .eq("id", activeDocumentId)
          .select("*")
          .single();

        if (error) throw error;

        setExistingRow(updatedRow);
        setDocumentPassword(password);

        setSaved(true);
        setIsDirty(false);

        setDialog(null);

        setFeedbackMessage(
          "Password changed successfully. Your recovery key remains unchanged."
        );
      }
    } catch (error) {
      console.error("Dialog action failed:", error);

      setDialogError(
        error.message || "Something went wrong. Please try again."
      );
    } finally {
      setDialogBusy(false);
    }
  }

  // Track content changes.
  function handleContentUpdate(json) {
    setContent(json);

    editVersionRef.current += 1;

    setIsDirty(true);
    setSaved(false);
    setSaveError("");
  }

  // Track title changes.
  function handleTitleChange(value) {
    setTitle(value);

    editVersionRef.current += 1;

    setIsDirty(true);
    setSaved(false);
    setSaveError("");
  }

  // Start the first-save password dialog.
  function handlePrepareSave() {
    setSaveError("");
    setFeedbackMessage("");

    if (!title.trim()) {
      setSaveError(
        "Please enter a document title before saving."
      );
      return;
    }

    openDialog("create-document-password");
  }

  // Save a new encrypted document to Supabase.
  async function handleSaveToCloud() {
    if (!pendingSave || saving || activeDocumentId) {
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;

      if (!userData.user) {
        throw new Error("Please log in again.");
      }

      const { data, error } = await supabase
        .from("documents")
        .insert({
          owner_id: userData.user.id,
          title: title.trim(),
          ...pendingSave.encrypted,
        })
        .select("*")
        .single();

      if (error) throw error;

      // Enable autosave after the first successful save.
      setActiveDocumentId(data.id);
      setExistingRow(data);
      setDocumentPassword(pendingSave.password);

      editVersionRef.current = 0;
      failedVersionRef.current = -1;

      setIsDirty(false);
      setSaved(true);

      setSaveError("");

      console.log("New document saved:", data.id);
    } catch (error) {
      console.error("New document save error:", error);

      setSaveError(
        error.message || "Failed to save document."
      );
    } finally {
      setSaving(false);
    }
  }

  // Autosave existing documents after two seconds.
  useEffect(() => {
    if (
      !activeDocumentId ||
      !existingRow ||
      !documentPassword ||
      !isDirty ||
      loadingDocument ||
      saving ||
      pendingSave
    ) {
      return;
    }

    // Avoid repeatedly retrying the same failed version.
    if (failedVersionRef.current === editVersionRef.current) {
      return;
    }

    const timer = setTimeout(async () => {
      const versionAtStart = editVersionRef.current;

      setSaving(true);
      setSaveError("");

      try {
        const updatedFields = await updateEncryptedDocument(
          existingRow,
          {
            title,
            content: content || {
              type: "doc",
              content: [{ type: "paragraph" }],
            },
            password: documentPassword,
          }
        );

        const { data: updatedRow, error } = await supabase
          .from("documents")
          .update(updatedFields)
          .eq("id", activeDocumentId)
          .select("*")
          .single();

        if (error) throw error;

        setExistingRow(updatedRow);

        // Mark saved only if no newer edits happened.
        if (editVersionRef.current === versionAtStart) {
          setIsDirty(false);
          setSaved(true);
          setSaveError("");
          failedVersionRef.current = -1;
        }
      } catch (error) {
        console.error("Autosave failed:", error);

        failedVersionRef.current = versionAtStart;

        setSaveError(
          error.message ||
            "Autosave failed. Your changes are retained."
        );
      } finally {
        setSaving(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    activeDocumentId,
    existingRow,
    documentPassword,
    isDirty,
    title,
    content,
    loadingDocument,
    saving,
    pendingSave,
    saveRetryToken,
  ]);

  // Manually retry a failed autosave.
  function handleRetrySave() {
    if (!activeDocumentId || !existingRow || saving) {
      return;
    }

    failedVersionRef.current = -1;

    setSaveError("");
    setSaved(false);

    setSaveRetryToken((previous) => previous + 1);
  }

  // Open the change-password dialog.
  function handleChangePassword() {
    if (
      !activeDocumentId ||
      !existingRow ||
      !documentPassword
    ) {
      return;
    }

    if (isDirty || saving) {
      setFeedbackMessage(
        "Please wait until all document changes are saved before changing the password."
      );
      return;
    }

    setFeedbackMessage("");
    openDialog("change-document-password");
  }

  // Copy recovery key.
  async function copyRecoveryKey() {
    if (!pendingSave) return;

    try {
      await navigator.clipboard.writeText(
        pendingSave.recoveryKey
      );

      setFeedbackMessage(
        "Recovery key copied successfully."
      );
    } catch {
      setFeedbackMessage(
        "Copy failed. Please download your recovery key."
      );
    }
  }

  // Download recovery key.
  function downloadRecoveryKey() {
    if (!pendingSave) return;

    const fileContent =
      "PRIVATE TEXT VAULT - DOCUMENT RECOVERY KEY\n\n" +
      "Keep this key secret and store it somewhere safe.\n" +
      "Anyone with this key can access the encrypted document.\n\n" +
      `Document: ${title}\n\n` +
      `Recovery Key: ${pendingSave.recoveryKey}\n`;

    const blob = new Blob([fileContent], {
      type: "text/plain",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "private-text-vault-recovery-key.txt";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function closeRecoveryModal() {
    if (!saved) return;

    setPendingSave(null);
    setFeedbackMessage("");
  }

  // Display save status.
  function getSaveStatus() {
    if (loadingDocument) return "Loading...";
    if (saving) return "Saving...";
    if (saveError) return "Save failed";
    if (isDirty) return "Unsaved changes";
    if (saved) return "All changes saved";

    return "Not saved";
  }

  return (
    <div className="editor-page">
      {/* Header */}
      <header className="editor-header">
        <button
          className="back-button"
          onClick={() => navigate("/dashboard")}
          type="button"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <div className="editor-brand">
          <LockKeyhole size={20} />
          Private Text Vault
        </div>

        <span className="editor-status">
          <FileText size={15} />
          {getSaveStatus()}
        </span>
      </header>

      {/* Main editor */}
      <main className="editor-container">
        {loadingDocument ? (
          <div className="loading-message">
            <span className="loading-spinner" />
            Loading and decrypting your document...
          </div>
        ) : documentError ? (
          <div>
            <p className="save-error">{documentError}</p>

            <button
              className="primary-button"
              onClick={() => navigate("/dashboard")}
              type="button"
            >
              Back to dashboard
            </button>
          </div>
        ) : (
          <>
            <input
              className="document-title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Document title"
              maxLength={100}
            />

            <p className="editor-description">
              Changes are encrypted before being uploaded.
            </p>

            {feedbackMessage && !pendingSave && (
              <p className="success-message" role="status">
                {feedbackMessage}
              </p>
            )}

            <TextEditor
              onUpdate={handleContentUpdate}
              initialContent={editorInitialContent}
            />

            <div className="editor-footer">
              <span>{wordCount} words</span>

              {activeDocumentId ? (
                <div className="editor-footer-actions">
                  <span className="editor-status">
                    <Save size={17} />
                    {getSaveStatus()}
                  </span>

                  <button
                    className="secondary-button"
                    onClick={handleChangePassword}
                    disabled={saving || isDirty}
                    type="button"
                  >
                    <KeyRound size={17} />
                    Change password
                  </button>
                </div>
              ) : (
                <button
                  className="primary-button"
                  onClick={handlePrepareSave}
                  disabled={saving || saved}
                  type="button"
                >
                  <Save size={17} />
                  Save document
                </button>
              )}
            </div>

            {saveError && (
              <div className="save-error-container">
                <p className="save-error" role="alert">
                  {saveError}
                </p>

                {activeDocumentId && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleRetrySave}
                    disabled={saving}
                  >
                    {saving ? "Retrying..." : "Retry save"}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* First-save recovery key modal */}
      {pendingSave && (
        <div className="recovery-modal-overlay">
          <div className="recovery-modal">
            {saved ? (
              <>
                <ShieldCheck size={42} />

                <h2>Document saved successfully!</h2>

                <p>
                  Your document is saved. Autosave is now enabled.
                  Keep your recovery key safe.
                </p>

                <div className="recovery-key-box">
                  {pendingSave.recoveryKey}
                </div>

                <button
                  className="secondary-button"
                  onClick={copyRecoveryKey}
                  type="button"
                >
                  <Copy size={17} />
                  Copy recovery key
                </button>

                {feedbackMessage && (
                  <p className="success-message" role="status">
                    {feedbackMessage}
                  </p>
                )}

                <button
                  className="primary-button"
                  onClick={closeRecoveryModal}
                  type="button"
                >
                  Continue editing
                </button>
              </>
            ) : (
              <>
                <ShieldCheck size={42} />

                <h2>Save your recovery key</h2>

                <p>
                  This key can recover your document if you forget
                  its password. We cannot recover it for you.
                </p>

                <div className="recovery-key-box">
                  {pendingSave.recoveryKey}
                </div>

                <button
                  className="secondary-button"
                  onClick={copyRecoveryKey}
                  type="button"
                >
                  <Copy size={17} />
                  Copy recovery key
                </button>

                {feedbackMessage && (
                  <p className="success-message" role="status">
                    {feedbackMessage}
                  </p>
                )}

                <button
                  className="secondary-button"
                  onClick={downloadRecoveryKey}
                  type="button"
                >
                  <Download size={17} />
                  Download recovery key
                </button>

                <button
                  className="primary-button"
                  onClick={handleSaveToCloud}
                  disabled={saving}
                  type="button"
                >
                  <Save size={17} />
                  {saving
                    ? "Saving..."
                    : "I saved my key – Save document"}
                </button>

                {saveError && (
                  <p className="save-error" role="alert">
                    {saveError}
                  </p>
                )}

                <p className="recovery-warning">
                  Do not close this window until your recovery key
                  is safely stored.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* In-app password and recovery dialogs */}
      {dialog && (
        <div className="recovery-modal-overlay">
          <div
            className="recovery-modal auth-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-dialog-title"
          >
            <button
              type="button"
              className="dialog-close-button"
              onClick={closeDialog}
              disabled={dialogBusy}
              aria-label="Close dialog"
            >
              ×
            </button>

            {dialog.type === "choose-open" ? (
              <>
                <LockKeyhole size={40} />

                <h2 id="document-dialog-title">
                  Unlock your document
                </h2>

                <p>
                  Choose how you want to open this encrypted document.
                </p>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => openDialog("document-password")}
                >
                  <LockKeyhole size={17} />
                  Use document password
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => openDialog("recovery-key")}
                >
                  <KeyRound size={17} />
                  Use recovery key
                </button>

                <button
                  type="button"
                  className="dialog-text-button"
                  onClick={closeDialog}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <LockKeyhole size={40} />

                <h2 id="document-dialog-title">
                  {dialog.type === "document-password" &&
                    "Enter document password"}

                  {dialog.type === "recovery-key" &&
                    "Recover your document"}

                  {dialog.type === "recovery-new-password" &&
                    "Create a new password"}

                  {dialog.type === "create-document-password" &&
                    "Protect your document"}

                  {dialog.type === "change-document-password" &&
                    "Change document password"}
                </h2>

                <p>
                  {dialog.type === "document-password" &&
                    "Enter the password you created for this document."}

                  {dialog.type === "recovery-key" &&
                    "Enter your saved recovery key to unlock your document."}

                  {dialog.type === "recovery-new-password" &&
                    "Recovery successful. Create a new password for this document."}

                  {dialog.type === "create-document-password" &&
                    "Create a password with at least 8 characters."}

                  {dialog.type === "change-document-password" &&
                    "Choose a new password for this document."}
                </p>

                <form onSubmit={handleDialogSubmit}>
                  {dialog.type === "document-password" && (
                    <input
                      type="password"
                      autoFocus
                      autoComplete="current-password"
                      placeholder="Document password"
                      value={dialogValues.password}
                      onChange={(e) =>
                        setDialogValues((old) => ({
                          ...old,
                          password: e.target.value,
                        }))
                      }
                      required
                    />
                  )}

                  {dialog.type === "recovery-key" && (
                    <textarea
                      autoFocus
                      rows={3}
                      placeholder="Paste your recovery key"
                      value={dialogValues.recoveryKey}
                      onChange={(e) =>
                        setDialogValues((old) => ({
                          ...old,
                          recoveryKey: e.target.value,
                        }))
                      }
                      required
                    />
                  )}

                  {(dialog.type === "recovery-new-password" ||
                    dialog.type === "create-document-password" ||
                    dialog.type === "change-document-password") && (
                    <>
                      <input
                        type="password"
                        autoFocus
                        autoComplete="new-password"
                        placeholder="New password (minimum 8 characters)"
                        minLength={8}
                        value={dialogValues.password}
                        onChange={(e) =>
                          setDialogValues((old) => ({
                            ...old,
                            password: e.target.value,
                          }))
                        }
                        required
                      />

                      <input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Confirm password"
                        value={dialogValues.confirmPassword}
                        onChange={(e) =>
                          setDialogValues((old) => ({
                            ...old,
                            confirmPassword: e.target.value,
                          }))
                        }
                        required
                      />
                    </>
                  )}

                  {dialogError && (
                    <p className="save-error" role="alert">
                      {dialogError}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={dialogBusy}
                  >
                    {dialogBusy
                      ? "Please wait..."
                      : dialog.type === "document-password"
                        ? "Unlock document"
                        : dialog.type === "recovery-key"
                          ? "Verify recovery key"
                          : dialog.type === "recovery-new-password"
                            ? "Set new password"
                            : dialog.type === "create-document-password"
                              ? "Create password"
                              : "Change password"}
                  </button>

                  <button
                    type="button"
                    className="dialog-text-button"
                    onClick={closeDialog}
                    disabled={dialogBusy}
                  >
                    Cancel
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Count words in TipTap JSON content.
function countWords(content) {
  if (!content) return 0;

  function extractText(node) {
    if (node.type === "text") {
      return node.text || "";
    }

    return (node.content || [])
      .map(extractText)
      .join(" ");
  }

  const text = extractText(content).trim();

  return text ? text.split(/\s+/).length : 0;
}

export default Editor;
