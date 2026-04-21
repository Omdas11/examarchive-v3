"use client";

import { useState, useEffect, useCallback } from "react";
import TypeToConfirmModal from "@/components/TypeToConfirmModal";

// ── Types ────────────────────────────────────────────────────────────────────

interface DevToolClientProps {
  adminEmail: string;
}

type ActionStatus = "idle" | "loading" | "success" | "error";
interface ActionState {
  status: ActionStatus;
  message: string;
}
const DEFAULT_STATE: ActionState = { status: "idle", message: "" };

type Tab = "databases" | "storage" | "auth" | "functions" | "danger";

interface AppwriteCollection {
  $id: string;
  name: string;
  $createdAt: string;
}
interface AppwriteDocument {
  $id: string;
  $collectionId: string;
  $createdAt: string;
  [key: string]: unknown;
}
interface AppwriteBucket {
  $id: string;
  name: string;
  $createdAt: string;
}
interface AppwriteFile {
  $id: string;
  name: string;
  sizeOriginal: number;
  $createdAt: string;
  mimeType: string;
}
interface AppwriteUser {
  $id: string;
  name: string;
  email: string;
  status: boolean;
  $createdAt: string;
  emailVerification: boolean;
}
interface AppwriteFunction {
  $id: string;
  name: string;
  runtime: string;
  status: string;
  $createdAt: string;
}
interface AppwriteExecution {
  $id: string;
  status: string;
  responseStatusCode: number;
  duration: number;
  $createdAt: string;
}

interface PendingDangerAction {
  action: string;
  confirmWord: string;
  title: string;
  description: string;
  setState: React.Dispatch<React.SetStateAction<ActionState>>;
  payload?: Record<string, unknown>;
}

// ── API helpers ──────────────────────────────────────────────────────────────

async function callAppwriteProxy(body: Record<string, unknown>) {
  const res = await fetch("/api/devtool/appwrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

async function callDevtool(body: Record<string, unknown>) {
  const res = await fetch("/api/devtool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

// ── Utilities ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  const styles: Record<ActionStatus, { bg: string; color: string }> = {
    idle: { bg: "transparent", color: "transparent" },
    loading: { bg: "#fef9c3", color: "#713f12" },
    success: { bg: "#dcfce7", color: "#166534" },
    error: { bg: "#fee2e2", color: "#991b1b" },
  };
  const { bg, color } = styles[state.status];
  return (
    <p className="mt-3 rounded-md px-3 py-2 text-xs font-medium" style={{ background: bg, color }}>
      {state.status === "success" ? "✓ " : state.status === "error" ? "✗ " : ""}
      {state.message}
    </p>
  );
}

function LoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 justify-center text-sm" style={{ color: "var(--color-text-muted)" }}>
      <span className="btn-spinner" />
      {label}
    </div>
  );
}

function Pagination({
  offset, limit, total, onPrev, onNext,
}: {
  offset: number; limit: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  return (
    <div className="flex items-center justify-between mt-3 gap-2">
      <button className="btn text-xs px-3 py-1.5" onClick={onPrev} disabled={offset === 0}>&#x2190; Prev</button>
      <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
        Page {page} / {totalPages} ({total} total)
      </span>
      <button className="btn text-xs px-3 py-1.5" onClick={onNext} disabled={offset + limit >= total}>Next &#x2192;</button>
    </div>
  );
}

// ── DATABASES TAB ─────────────────────────────────────────────────────────────

function DatabasesTab() {
  const COL_LIMIT = 50;
  const DOC_LIMIT = 20;
  const [collections, setCollections] = useState<AppwriteCollection[]>([]);
  const [colTotal, setColTotal] = useState(0);
  const [colOffset, setColOffset] = useState(0);
  const [colLoading, setColLoading] = useState(false);
  const [colError, setColError] = useState("");
  const [selectedCol, setSelectedCol] = useState<AppwriteCollection | null>(null);
  const [documents, setDocuments] = useState<AppwriteDocument[]>([]);
  const [docTotal, setDocTotal] = useState(0);
  const [docOffset, setDocOffset] = useState(0);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState("");
  const [editingDoc, setEditingDoc] = useState<AppwriteDocument | null>(null);
  const [editJson, setEditJson] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [saveState, setSaveState] = useState<ActionState>(DEFAULT_STATE);
  const [deleteState, setDeleteState] = useState<ActionState>(DEFAULT_STATE);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadCollections = useCallback(async (off: number) => {
    setColLoading(true); setColError("");
    try {
      const data = await callAppwriteProxy({ action: "listCollections", limit: COL_LIMIT, offset: off });
      setCollections(data.collections ?? []); setColTotal(data.total ?? 0); setColOffset(off);
    } catch (e) { setColError(e instanceof Error ? e.message : "Failed to load collections"); }
    finally { setColLoading(false); }
  }, []);

  const loadDocuments = useCallback(async (col: AppwriteCollection, off: number) => {
    setDocLoading(true); setDocError(""); setDeleteState(DEFAULT_STATE);
    try {
      const data = await callAppwriteProxy({ action: "listDocuments", collectionId: col.$id, limit: DOC_LIMIT, offset: off });
      setDocuments(data.documents ?? []); setDocTotal(data.total ?? 0); setDocOffset(off);
    } catch (e) { setDocError(e instanceof Error ? e.message : "Failed to load documents"); }
    finally { setDocLoading(false); }
  }, []);

  useEffect(() => { loadCollections(0); }, [loadCollections]);

  function openCollection(col: AppwriteCollection) {
    setSelectedCol(col); setDocuments([]); setDocTotal(0); setDocOffset(0); setEditingDoc(null);
    loadDocuments(col, 0);
  }

  function openDocEditor(doc: AppwriteDocument) {
    const editable: Record<string, unknown> = {};
    for (const key of Object.keys(doc)) { if (!key.startsWith("$")) editable[key] = doc[key]; }
    setEditingDoc(doc); setEditJson(JSON.stringify(editable, null, 2)); setJsonError(""); setSaveState(DEFAULT_STATE);
  }

  async function saveDocument() {
    if (!editingDoc || !selectedCol) return;
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(editJson); } catch { setJsonError("Invalid JSON – please fix before saving."); return; }
    setJsonError(""); setSaveState({ status: "loading", message: "Saving…" });
    try {
      await callAppwriteProxy({ action: "updateDocument", collectionId: selectedCol.$id, documentId: editingDoc.$id, data: parsed });
      setSaveState({ status: "success", message: "Document saved successfully." });
      await loadDocuments(selectedCol, docOffset);
      setEditingDoc(null);
    } catch (e) { setSaveState({ status: "error", message: e instanceof Error ? e.message : "Save failed." }); }
  }

  async function deleteDocument(docId: string) {
    if (!selectedCol) return;
    setDeleteState({ status: "loading", message: "Deleting…" }); setDeleteConfirmId(null);
    try {
      await callAppwriteProxy({ action: "deleteDocument", collectionId: selectedCol.$id, documentId: docId });
      setDeleteState({ status: "success", message: "Document deleted." });
      await loadDocuments(selectedCol, docOffset);
    } catch (e) { setDeleteState({ status: "error", message: e instanceof Error ? e.message : "Delete failed." }); }
  }

  // Edit view
  if (editingDoc) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button className="btn text-xs px-3 py-1.5" onClick={() => setEditingDoc(null)}>&#x2190; Back</button>
          <h3 className="text-sm font-semibold truncate">Edit: {editingDoc.$id}</h3>
        </div>
        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
          Collection: <strong>{selectedCol?.name}</strong>. Only non-system fields are editable.
        </p>
        {jsonError && <p className="text-xs rounded px-2 py-1" style={{ background: "#fee2e2", color: "#991b1b" }}>{jsonError}</p>}
        <textarea
          value={editJson}
          onChange={(e) => setEditJson(e.target.value)}
          className="input-field w-full font-mono text-xs"
          rows={18}
          spellCheck={false}
          style={{ resize: "vertical" }}
        />
        <div className="flex gap-2">
          <button className="btn text-sm px-4 py-2" onClick={saveDocument} disabled={saveState.status === "loading"}>
            {saveState.status === "loading" && <span className="btn-spinner" />}
            {saveState.status === "loading" ? "Saving…" : "Save Changes"}
          </button>
          <button className="btn text-sm px-4 py-2" onClick={() => setEditingDoc(null)}>Cancel</button>
        </div>
        <StatusBadge state={saveState} />
      </div>
    );
  }

  // Document list view
  if (selectedCol) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn text-xs px-3 py-1.5" onClick={() => { setSelectedCol(null); setDocuments([]); }}>&#x2190; Collections</button>
          <h3 className="text-sm font-semibold">{selectedCol.name}</h3>
          <span className="text-xs ml-auto" style={{ color: "var(--color-text-muted)" }}>{docTotal} docs</span>
          <button className="btn text-xs px-3 py-1.5" onClick={() => loadDocuments(selectedCol, docOffset)}>Refresh</button>
        </div>
        <StatusBadge state={deleteState} />
        {docLoading && <LoadingSpinner label="Loading documents…" />}
        {docError && <p className="text-xs rounded px-2 py-1" style={{ background: "#fee2e2", color: "#991b1b" }}>{docError}</p>}
        {!docLoading && documents.length === 0 && !docError && (
          <p className="text-sm text-center py-6" style={{ color: "var(--color-text-muted)" }}>No documents found.</p>
        )}
        <div className="space-y-2">
          {documents.map((doc) => {
            const preview = Object.entries(doc)
              .filter(([k]) => !k.startsWith("$"))
              .slice(0, 3)
              .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
              .join(" · ");
            return (
              <div key={doc.$id} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-mono font-semibold truncate">{doc.$id}</p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--color-text-muted)" }}>{preview || "(empty)"}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{formatDate(doc.$createdAt)}</p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button className="btn text-xs px-2 py-1" onClick={() => openDocEditor(doc)}>Edit</button>
                    {deleteConfirmId === doc.$id ? (
                      <div className="flex gap-1">
                        <button
                          className="btn text-xs px-2 py-1"
                          style={{ background: "var(--brand-crimson)", color: "#fff", borderColor: "var(--brand-crimson)" }}
                          onClick={() => deleteDocument(doc.$id)}
                        >
                          Confirm
                        </button>
                        <button className="btn text-xs px-2 py-1" onClick={() => setDeleteConfirmId(null)}>&#x00D7;</button>
                      </div>
                    ) : (
                      <button
                        className="btn text-xs px-2 py-1"
                        style={{ borderColor: "var(--brand-crimson)", color: "var(--brand-crimson)" }}
                        onClick={() => setDeleteConfirmId(doc.$id)}
                        disabled={deleteState.status === "loading"}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <Pagination
          offset={docOffset} limit={DOC_LIMIT} total={docTotal}
          onPrev={() => loadDocuments(selectedCol, docOffset - DOC_LIMIT)}
          onNext={() => loadDocuments(selectedCol, docOffset + DOC_LIMIT)}
        />
      </div>
    );
  }

  // Collection list view
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Collections ({colTotal})</h3>
        <button className="btn text-xs px-3 py-1.5" onClick={() => loadCollections(colOffset)}>Refresh</button>
      </div>
      {colLoading && <LoadingSpinner label="Loading collections…" />}
      {colError && <p className="text-xs rounded px-2 py-1" style={{ background: "#fee2e2", color: "#991b1b" }}>{colError}</p>}
      {!colLoading && collections.length === 0 && !colError && (
        <p className="text-sm text-center py-6" style={{ color: "var(--color-text-muted)" }}>No collections found.</p>
      )}
      <div className="space-y-2">
        {collections.map((col) => (
          <button key={col.$id} className="card p-3 w-full text-left" onClick={() => openCollection(col)}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{col.name}</p>
                <p className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>{col.$id}</p>
              </div>
              <span className="text-lg shrink-0">&#x203A;</span>
            </div>
          </button>
        ))}
      </div>
      <Pagination
        offset={colOffset} limit={COL_LIMIT} total={colTotal}
        onPrev={() => loadCollections(colOffset - COL_LIMIT)}
        onNext={() => loadCollections(colOffset + COL_LIMIT)}
      />
    </div>
  );
}

// ── STORAGE TAB ───────────────────────────────────────────────────────────────

function StorageTab() {
  const FILE_LIMIT = 20;
  const [buckets, setBuckets] = useState<AppwriteBucket[]>([]);
  const [bucketTotal, setBucketTotal] = useState(0);
  const [bucketsLoading, setBucketsLoading] = useState(false);
  const [bucketsError, setBucketsError] = useState("");
  const [selectedBucket, setSelectedBucket] = useState<AppwriteBucket | null>(null);
  const [files, setFiles] = useState<AppwriteFile[]>([]);
  const [fileTotal, setFileTotal] = useState(0);
  const [fileOffset, setFileOffset] = useState(0);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");
  const [deleteState, setDeleteState] = useState<ActionState>(DEFAULT_STATE);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadBuckets = useCallback(async () => {
    setBucketsLoading(true); setBucketsError("");
    try {
      const data = await callAppwriteProxy({ action: "listBuckets" });
      setBuckets(data.buckets ?? []); setBucketTotal(data.total ?? 0);
    } catch (e) { setBucketsError(e instanceof Error ? e.message : "Failed to load buckets"); }
    finally { setBucketsLoading(false); }
  }, []);

  const loadFiles = useCallback(async (bucket: AppwriteBucket, off: number) => {
    setFilesLoading(true); setFilesError(""); setDeleteState(DEFAULT_STATE);
    try {
      const data = await callAppwriteProxy({ action: "listFiles", bucketId: bucket.$id, limit: FILE_LIMIT, offset: off });
      setFiles(data.files ?? []); setFileTotal(data.total ?? 0); setFileOffset(off);
    } catch (e) { setFilesError(e instanceof Error ? e.message : "Failed to load files"); }
    finally { setFilesLoading(false); }
  }, []);

  useEffect(() => { loadBuckets(); }, [loadBuckets]);

  async function deleteFile(fileId: string) {
    if (!selectedBucket) return;
    setDeleteState({ status: "loading", message: "Deleting…" }); setDeleteConfirmId(null);
    try {
      await callAppwriteProxy({ action: "deleteFile", bucketId: selectedBucket.$id, fileId });
      setDeleteState({ status: "success", message: "File deleted." });
      await loadFiles(selectedBucket, fileOffset);
    } catch (e) { setDeleteState({ status: "error", message: e instanceof Error ? e.message : "Delete failed." }); }
  }

  if (selectedBucket) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn text-xs px-3 py-1.5" onClick={() => { setSelectedBucket(null); setFiles([]); }}>&#x2190; Buckets</button>
          <h3 className="text-sm font-semibold">{selectedBucket.name}</h3>
          <span className="text-xs ml-auto" style={{ color: "var(--color-text-muted)" }}>{fileTotal} files</span>
          <button className="btn text-xs px-3 py-1.5" onClick={() => loadFiles(selectedBucket, fileOffset)}>Refresh</button>
        </div>
        <StatusBadge state={deleteState} />
        {filesLoading && <LoadingSpinner label="Loading files…" />}
        {filesError && <p className="text-xs rounded px-2 py-1" style={{ background: "#fee2e2", color: "#991b1b" }}>{filesError}</p>}
        {!filesLoading && files.length === 0 && !filesError && (
          <p className="text-sm text-center py-6" style={{ color: "var(--color-text-muted)" }}>Bucket is empty.</p>
        )}
        <div className="space-y-2">
          {files.map((file) => (
            <div key={file.$id} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{file.name}</p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{formatBytes(file.sizeOriginal)} · {file.mimeType}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{formatDate(file.$createdAt)}</p>
                </div>
                <div className="shrink-0">
                  {deleteConfirmId === file.$id ? (
                    <div className="flex gap-1">
                      <button
                        className="btn text-xs px-2 py-1"
                        style={{ background: "var(--brand-crimson)", color: "#fff", borderColor: "var(--brand-crimson)" }}
                        onClick={() => deleteFile(file.$id)}
                      >
                        Confirm
                      </button>
                      <button className="btn text-xs px-2 py-1" onClick={() => setDeleteConfirmId(null)}>&#x00D7;</button>
                    </div>
                  ) : (
                    <button
                      className="btn text-xs px-2 py-1"
                      style={{ borderColor: "var(--brand-crimson)", color: "var(--brand-crimson)" }}
                      onClick={() => setDeleteConfirmId(file.$id)}
                      disabled={deleteState.status === "loading"}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <Pagination
          offset={fileOffset} limit={FILE_LIMIT} total={fileTotal}
          onPrev={() => loadFiles(selectedBucket, fileOffset - FILE_LIMIT)}
          onNext={() => loadFiles(selectedBucket, fileOffset + FILE_LIMIT)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Buckets ({bucketTotal})</h3>
        <button className="btn text-xs px-3 py-1.5" onClick={loadBuckets}>Refresh</button>
      </div>
      {bucketsLoading && <LoadingSpinner label="Loading buckets…" />}
      {bucketsError && <p className="text-xs rounded px-2 py-1" style={{ background: "#fee2e2", color: "#991b1b" }}>{bucketsError}</p>}
      {!bucketsLoading && buckets.length === 0 && !bucketsError && (
        <p className="text-sm text-center py-6" style={{ color: "var(--color-text-muted)" }}>No buckets found.</p>
      )}
      <div className="space-y-2">
        {buckets.map((bucket) => (
          <button key={bucket.$id} className="card p-3 w-full text-left" onClick={() => { setSelectedBucket(bucket); loadFiles(bucket, 0); }}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{bucket.name}</p>
                <p className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>{bucket.$id}</p>
              </div>
              <span className="text-lg shrink-0">&#x203A;</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── AUTH TAB ──────────────────────────────────────────────────────────────────

function AuthTab() {
  const LIMIT = 20;
  const [users, setUsers] = useState<AppwriteUser[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async (off: number) => {
    setLoading(true); setError("");
    try {
      const data = await callAppwriteProxy({ action: "listUsers", limit: LIMIT, offset: off });
      setUsers(data.users ?? []); setTotal(data.total ?? 0); setOffset(off);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load users"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(0); }, [loadUsers]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Auth Users ({total})</h3>
        <button className="btn text-xs px-3 py-1.5" onClick={() => loadUsers(offset)}>Refresh</button>
      </div>
      {loading && <LoadingSpinner label="Loading users…" />}
      {error && <p className="text-xs rounded px-2 py-1" style={{ background: "#fee2e2", color: "#991b1b" }}>{error}</p>}
      {!loading && users.length === 0 && !error && (
        <p className="text-sm text-center py-6" style={{ color: "var(--color-text-muted)" }}>No users found.</p>
      )}
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.$id} className="card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{u.name || "(no name)"}</p>
                <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>{u.email}</p>
                <p className="text-xs font-mono mt-0.5" style={{ color: "var(--color-text-muted)" }}>{u.$id}</p>
                <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>{formatDate(u.$createdAt)}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span
                  className="text-xs rounded-full px-2 py-0.5 font-medium"
                  style={{ background: u.status ? "#dcfce7" : "#fee2e2", color: u.status ? "#166534" : "#991b1b" }}
                >
                  {u.status ? "Active" : "Blocked"}
                </span>
                {u.emailVerification && (
                  <span className="text-xs rounded-full px-2 py-0.5 font-medium" style={{ background: "#dbeafe", color: "#1e40af" }}>
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Pagination
        offset={offset} limit={LIMIT} total={total}
        onPrev={() => loadUsers(offset - LIMIT)}
        onNext={() => loadUsers(offset + LIMIT)}
      />
    </div>
  );
}

// ── FUNCTIONS TAB ─────────────────────────────────────────────────────────────

function FunctionsTab() {
  const [functions, setFunctions] = useState<AppwriteFunction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedFn, setSelectedFn] = useState<AppwriteFunction | null>(null);
  const [executions, setExecutions] = useState<AppwriteExecution[]>([]);
  const [execTotal, setExecTotal] = useState(0);
  const [execLoading, setExecLoading] = useState(false);
  const [execError, setExecError] = useState("");

  const loadFunctions = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await callAppwriteProxy({ action: "listFunctions" });
      setFunctions(data.functions ?? []); setTotal(data.total ?? 0);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load functions"); }
    finally { setLoading(false); }
  }, []);

  async function loadExecutions(fn: AppwriteFunction) {
    setSelectedFn(fn); setExecLoading(true); setExecError("");
    try {
      const data = await callAppwriteProxy({ action: "listExecutions", functionId: fn.$id, limit: 10 });
      setExecutions(data.executions ?? []); setExecTotal(data.total ?? 0);
    } catch (e) { setExecError(e instanceof Error ? e.message : "Failed to load executions"); }
    finally { setExecLoading(false); }
  }

  useEffect(() => { loadFunctions(); }, [loadFunctions]);

  function statusStyle(status: string): React.CSSProperties {
    if (status === "completed" || status === "enabled") return { background: "#dcfce7", color: "#166534" };
    if (status === "failed" || status === "disabled") return { background: "#fee2e2", color: "#991b1b" };
    if (status === "processing") return { background: "#fef9c3", color: "#713f12" };
    return { background: "var(--color-surface-alt)", color: "var(--color-text-muted)" };
  }

  if (selectedFn) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button className="btn text-xs px-3 py-1.5" onClick={() => { setSelectedFn(null); setExecutions([]); }}>&#x2190; Functions</button>
          <h3 className="text-sm font-semibold">{selectedFn.name}</h3>
          <span className="text-xs ml-auto" style={{ color: "var(--color-text-muted)" }}>{execTotal} executions</span>
        </div>
        {execLoading && <LoadingSpinner label="Loading executions…" />}
        {execError && <p className="text-xs rounded px-2 py-1" style={{ background: "#fee2e2", color: "#991b1b" }}>{execError}</p>}
        {!execLoading && executions.length === 0 && !execError && (
          <p className="text-sm text-center py-6" style={{ color: "var(--color-text-muted)" }}>No executions found.</p>
        )}
        <div className="space-y-2">
          {executions.map((exec) => (
            <div key={exec.$id} className="card p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono truncate" style={{ color: "var(--color-text-muted)" }}>{exec.$id}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    {formatDate(exec.$createdAt)} · {(exec.duration ?? 0).toFixed(2)}s · HTTP {exec.responseStatusCode}
                  </p>
                </div>
                <span className="text-xs rounded-full px-2 py-0.5 font-medium shrink-0" style={statusStyle(exec.status)}>
                  {exec.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Functions ({total})</h3>
        <button className="btn text-xs px-3 py-1.5" onClick={loadFunctions}>Refresh</button>
      </div>
      {loading && <LoadingSpinner label="Loading functions…" />}
      {error && <p className="text-xs rounded px-2 py-1" style={{ background: "#fee2e2", color: "#991b1b" }}>{error}</p>}
      {!loading && functions.length === 0 && !error && (
        <p className="text-sm text-center py-6" style={{ color: "var(--color-text-muted)" }}>No functions found.</p>
      )}
      <div className="space-y-2">
        {functions.map((fn) => (
          <button key={fn.$id} className="card p-3 w-full text-left" onClick={() => loadExecutions(fn)}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{fn.name}</p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{fn.runtime} · {fn.$id}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs rounded-full px-2 py-0.5 font-medium" style={statusStyle(fn.status)}>
                  {fn.status}
                </span>
                <span className="text-lg">&#x203A;</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── DANGER TAB ────────────────────────────────────────────────────────────────

interface DangerItem {
  label: string;
  desc: string;
  action: string;
  word: string;
  setState: React.Dispatch<React.SetStateAction<ActionState>>;
  state: ActionState;
  danger: boolean;
}

function DangerTab({ onOpenModal }: { onOpenModal: (action: PendingDangerAction) => void }) {
  const [clearPapersState, setClearPapersState] = useState<ActionState>(DEFAULT_STATE);
  const [clearUploadsState, setClearUploadsState] = useState<ActionState>(DEFAULT_STATE);
  const [clearLogsState, setClearLogsState] = useState<ActionState>(DEFAULT_STATE);
  const [resetUsersXpState, setResetUsersXpState] = useState<ActionState>(DEFAULT_STATE);
  const [clearSyllabusState, setClearSyllabusState] = useState<ActionState>(DEFAULT_STATE);
  const [purgeCollectionsState, setPurgeCollectionsState] = useState<ActionState>(DEFAULT_STATE);
  const [healthState, setHealthState] = useState<ActionState>(DEFAULT_STATE);
  const [overrideUserId, setOverrideUserId] = useState("");
  const [overrideRole, setOverrideRole] = useState("student");
  const [overrideState, setOverrideState] = useState<ActionState>(DEFAULT_STATE);
  const [xpUserId, setXpUserId] = useState("");
  const [xpAmount, setXpAmount] = useState("");
  const [xpMode, setXpMode] = useState<"add" | "set">("add");
  const [xpState, setXpState] = useState<ActionState>(DEFAULT_STATE);

  async function runHealthCheck() {
    setHealthState({ status: "loading", message: "Checking…" });
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (res.ok) {
        setHealthState({ status: "success", message: `System healthy. DB: ${data.db ?? "ok"}, Storage: ${data.storage ?? "ok"}` });
      } else {
        setHealthState({ status: "error", message: data.error ?? "Health check failed." });
      }
    } catch {
      setHealthState({ status: "error", message: "Could not reach health endpoint." });
    }
  }

  async function handleRoleOverride() {
    if (!overrideUserId.trim()) { setOverrideState({ status: "error", message: "User ID is required." }); return; }
    setOverrideState({ status: "loading", message: "Running…" });
    const { ok, data } = await callDevtool({ action: "role_override", userId: overrideUserId, role: overrideRole });
    if (ok && data.success) { setOverrideState({ status: "success", message: data.message ?? "Role updated." }); }
    else { setOverrideState({ status: "error", message: data.error ?? "Role override failed." }); }
  }

  async function handleXpManipulation() {
    if (!xpUserId.trim() || !xpAmount) { setXpState({ status: "error", message: "User ID and XP amount are required." }); return; }
    const amount = parseInt(xpAmount, 10);
    if (isNaN(amount)) { setXpState({ status: "error", message: "XP amount must be a number." }); return; }
    setXpState({ status: "loading", message: "Running…" });
    const { ok, data } = await callDevtool({ action: `xp_${xpMode}`, userId: xpUserId, amount });
    if (ok && data.success) { setXpState({ status: "success", message: data.message ?? "XP updated." }); }
    else { setXpState({ status: "error", message: data.error ?? "XP manipulation failed." }); }
  }

  const dangerItems: DangerItem[] = [
    { label: "Purge All Collections (skip users)", desc: "Deletes every document from every collection except users.", action: "purge_collections", word: "PURGE", setState: setPurgeCollectionsState, state: purgeCollectionsState, danger: true },
    { label: "Reset All Users XP & Streak", desc: "Sets XP to 0 and streak_days to 0 for every user.", action: "reset_users_xp", word: "RESET", setState: setResetUsersXpState, state: resetUsersXpState, danger: false },
    { label: "Clear Pending Uploads", desc: "Removes all unapproved paper submissions. Approved papers are unaffected.", action: "clear_pending_uploads", word: "DELETE", setState: setClearUploadsState, state: clearUploadsState, danger: false },
    { label: "Clear Pending Syllabi", desc: "Removes all pending/unapproved syllabus submissions.", action: "clear_pending_syllabus", word: "DELETE", setState: setClearSyllabusState, state: clearSyllabusState, danger: false },
    { label: "Clear Activity Logs", desc: "Deletes all entries from the activity_logs collection.", action: "clear_activity_logs", word: "DELETE", setState: setClearLogsState, state: clearLogsState, danger: false },
    { label: "Reset All Papers", desc: "DANGER: Permanently deletes ALL papers (approved and pending).", action: "reset_all_papers", word: "RESET", setState: setClearPapersState, state: clearPapersState, danger: true },
  ];

  return (
    <div className="space-y-5">
      {/* System Health */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-1">System Health</h3>
        <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>Connectivity check against Appwrite DB and Storage.</p>
        <button className="btn text-sm px-4 py-2" onClick={runHealthCheck} disabled={healthState.status === "loading"}>
          {healthState.status === "loading" && <span className="btn-spinner" />}
          {healthState.status === "loading" ? "Checking…" : "Run Health Check"}
        </button>
        <StatusBadge state={healthState} />
      </div>

      {/* Role Override */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-1">Role Override</h3>
        <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>Force-set a user&apos;s primary role. Use the Appwrite User ID (not email).</p>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={overrideUserId}
            onChange={(e) => setOverrideUserId(e.target.value)}
            placeholder="Appwrite User ID"
            className="input-field"
          />
          <div className="flex gap-2">
            <select value={overrideRole} onChange={(e) => setOverrideRole(e.target.value)} className="input-field flex-1">
              <option value="student">student</option>
              <option value="moderator">moderator</option>
              <option value="admin">admin</option>
              <option value="founder">founder</option>
            </select>
            <button className="btn text-sm px-4 py-2 shrink-0" onClick={handleRoleOverride} disabled={overrideState.status === "loading"}>
              {overrideState.status === "loading" && <span className="btn-spinner" />}
              {overrideState.status === "loading" ? "Running…" : "Override"}
            </button>
          </div>
        </div>
        <StatusBadge state={overrideState} />
      </div>

      {/* XP Manipulation */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold mb-1">XP Manipulation</h3>
        <p className="text-xs mb-3" style={{ color: "var(--color-text-muted)" }}>Add or set XP for a specific user. Use the Appwrite User ID.</p>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={xpUserId}
            onChange={(e) => setXpUserId(e.target.value)}
            placeholder="Appwrite User ID"
            className="input-field"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={xpAmount}
              onChange={(e) => setXpAmount(e.target.value)}
              placeholder="XP amount"
              className="input-field flex-1"
            />
            <select value={xpMode} onChange={(e) => setXpMode(e.target.value as "add" | "set")} className="input-field w-24 shrink-0">
              <option value="add">Add</option>
              <option value="set">Set</option>
            </select>
            <button className="btn text-sm px-4 py-2 shrink-0" onClick={handleXpManipulation} disabled={xpState.status === "loading"}>
              {xpState.status === "loading" && <span className="btn-spinner" />}
              {xpState.status === "loading" ? "Running…" : "Apply"}
            </button>
          </div>
        </div>
        <StatusBadge state={xpState} />
      </div>

      {/* Danger Zone */}
      <div className="danger-zone">
        <div className="danger-zone-title">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Danger Zone
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
          Destructive actions – cannot be undone. Each requires typing a confirmation word.
        </p>
        <div className="space-y-3">
          {dangerItems.map(({ label, desc, action, word, setState, state, danger }) => (
            <div
              key={action}
              className="p-3 rounded-lg"
              style={{
                border: danger ? "2px solid var(--brand-crimson)" : "1px solid var(--color-border)",
                background: danger ? "color-mix(in srgb, var(--brand-crimson) 6%, var(--color-surface))" : undefined,
              }}
            >
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-sm font-semibold" style={danger ? { color: "var(--brand-crimson)" } : {}}>
                    {label}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>{desc}</p>
                </div>
                <button
                  className="btn text-sm px-4 py-2 self-start"
                  style={danger
                    ? { background: "var(--brand-crimson)", color: "#fff", borderColor: "var(--brand-crimson)" }
                    : { borderColor: "var(--brand-crimson)", color: "var(--brand-crimson)" }
                  }
                  onClick={() => onOpenModal({ action, confirmWord: word, title: label, description: desc, setState })}
                  disabled={state.status === "loading"}
                >
                  {state.status === "loading" && <span className="btn-spinner" />}
                  {state.status === "loading" ? "Running…" : label}
                </button>
                <StatusBadge state={state} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "databases", label: "Databases", icon: "🗄️" },
  { id: "storage", label: "Storage", icon: "🪣" },
  { id: "auth", label: "Auth", icon: "👤" },
  { id: "functions", label: "Functions", icon: "⚡" },
  { id: "danger", label: "Danger", icon: "⚠️" },
];

export default function DevToolClient({ adminEmail }: DevToolClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("databases");
  const [pendingDangerAction, setPendingDangerAction] = useState<PendingDangerAction | null>(null);
  const [dangerActionLoading, setDangerActionLoading] = useState(false);

  function handleDangerCancel() {
    if (!dangerActionLoading) setPendingDangerAction(null);
  }

  async function executeDangerAction() {
    if (!pendingDangerAction) return;
    const { action, setState, payload } = pendingDangerAction;
    setDangerActionLoading(true);
    setState({ status: "loading", message: "Running…" });
    try {
      const { ok, data } = await callDevtool({ action, ...payload });
      if (ok && data.success) {
        setState({ status: "success", message: data.message ?? "Done." });
      } else {
        setState({ status: "error", message: data.error ?? "Action failed." });
      }
    } catch {
      setState({ status: "error", message: "Network error. Please try again." });
    } finally {
      setDangerActionLoading(false);
      setPendingDangerAction(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Operator info */}
      <div className="card p-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
        Signed in as <strong>{adminEmail}</strong>
      </div>

      {/* Tab bar */}
      <div
        className="flex overflow-x-auto gap-1 pb-1 -mx-1 px-1"
        style={{ scrollbarWidth: "none" }}
        role="tablist"
        aria-label="Appwrite Console sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
            style={
              activeTab === tab.id
                ? { background: "var(--color-primary)", color: "#fff" }
                : { background: "var(--color-surface-alt)", color: "var(--color-text-muted)" }
            }
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {activeTab === "databases" && <DatabasesTab />}
        {activeTab === "storage" && <StorageTab />}
        {activeTab === "auth" && <AuthTab />}
        {activeTab === "functions" && <FunctionsTab />}
        {activeTab === "danger" && <DangerTab onOpenModal={setPendingDangerAction} />}
      </div>

      {/* Type-to-Confirm Modal */}
      <TypeToConfirmModal
        open={pendingDangerAction !== null}
        title={pendingDangerAction?.title ?? ""}
        description={pendingDangerAction?.description ?? ""}
        confirmWord={pendingDangerAction?.confirmWord ?? ""}
        onConfirm={executeDangerAction}
        onCancel={handleDangerCancel}
        loading={dangerActionLoading}
      />
    </div>
  );
}
