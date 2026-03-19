"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import ModelSelect from "@/components/ModelSelect";
import type { CoursePrefsPayload } from "@/lib/pdf-rag";

interface GeneratedDoc {
  topic: string;
  content: string;
  generatedAt: string;
  model?: string;
  sources?: string[];
  pageLength?: number;
}

interface AIContentClientProps {
  userRole: string;
}

export default function AIContentClient({ userRole }: AIContentClientProps) {
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [loadingStep, setLoadingStep] = useState("Preparing");
  const [documents, setDocuments] = useState<GeneratedDoc[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isFounder, setIsFounder] = useState(false);
  const [isAdminPlus, setIsAdminPlus] = useState(false);
  const [pageLength, setPageLength] = useState(1);
  const [pageOptions, setPageOptions] = useState<number[]>([1]);
  const [model, setModel] = useState("");
  const [modelOptions, setModelOptions] = useState<Array<{ id: string; label: string; available: boolean }>>([]);
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<GeneratedDoc | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const loadingIntervalRef = useRef<number | null>(null);

  const DAILY_LIMIT = 5;

  // Fetch remaining quota on load
  useEffect(() => {
    fetch("/api/ai/generate")
      .then((r) => r.json())
      .then((d) => {
        setRemaining(d.remaining ?? null);
        setIsFounder(d.isFounder ?? false);
        setIsAdminPlus(d.isAdminPlus ?? false);
        const fetchedModels = Array.isArray(d.modelOptions) ? d.modelOptions : [];
        setModelOptions(fetchedModels);
        const availableModels = fetchedModels.filter((option: { available: boolean }) => option.available);
        setModel(availableModels[0]?.id ?? "");
        const fetchedPages = Array.isArray(d.pageOptions) ? d.pageOptions.filter((v: unknown) => Number.isFinite(v)) : [1];
        const normalizedPages = fetchedPages.length > 0 ? fetchedPages : [1];
        setPageOptions(normalizedPages);
        setPageLength((current) => (normalizedPages.includes(current) ? current : normalizedPages[0]));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (loadingIntervalRef.current) {
        window.clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
    };
  }, []);

  async function generate() {
    const trimmed = topic.trim();
    if (!trimmed || generating) return;
    setGenerating(true);
    if (loadingIntervalRef.current) {
      window.clearInterval(loadingIntervalRef.current);
    }
    const steps = [
      "Preparing",
      "Retrieving archive context",
      ...(useWebSearch ? ["Checking latest web updates"] : []),
      "Generating notes",
      "Finalizing PDF-ready output",
    ];
    let stepIndex = 0;
    setLoadingStep(steps[0]);
    loadingIntervalRef.current = window.setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, steps.length - 1);
      setLoadingStep(steps[stepIndex]);
    }, 900);
    setError(null);

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: trimmed,
          pageLength,
          model,
          useWebSearch,
          coursePrefs: loadCoursePrefsFromStorage(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Generation failed.");
        return;
      }

      const doc: GeneratedDoc = {
        topic: data.topic,
        content: data.content,
        generatedAt: data.generatedAt,
        model: data.model,
        sources: Array.isArray(data.sources) ? data.sources : [],
        pageLength: typeof data.pageLength === "number" ? data.pageLength : pageLength,
      };

      setDocuments((prev) => [doc, ...prev]);
      setActiveDoc(doc);
      setTopic("");
      if (data.remaining !== undefined && data.remaining !== null) {
        setRemaining(data.remaining);
      }
      if (Array.isArray(data.pageOptions)) {
        setPageOptions(data.pageOptions);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      if (loadingIntervalRef.current) {
        window.clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = null;
      }
      setGenerating(false);
    }
  }

  /**
   * Reads course preference payload from localStorage key `ea_course_prefs`.
   * Fields map to programme buckets:
   * dsc=Discipline Specific Core, dsm1/dsm2=Discipline Specific Minor,
   * sec=Skill Enhancement Course, idc=Interdisciplinary Course,
   * aec=Ability Enhancement Course, vac=Value Added Course.
   */
  function loadCoursePrefsFromStorage(): CoursePrefsPayload | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("ea_course_prefs");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CoursePrefsPayload>;
      return {
        dsc: parsed.dsc ?? "",
        dsm1: parsed.dsm1 ?? "",
        dsm2: parsed.dsm2 ?? "",
        sec: parsed.sec ?? "",
        idc: parsed.idc ?? "",
        aec: parsed.aec ?? "",
        vac: parsed.vac ?? "",
      };
    } catch {
      return null;
    }
  }

  async function handlePrint() {
    if (!activeDoc) return;

    try {
      const response = await fetch("/api/ai/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: activeDoc.content,
          topic: activeDoc.topic,
          pageLength: activeDoc.pageLength || 5,
        }),
      });

      if (!response.ok) {
        alert("Failed to generate PDF. Please try again.");
        return;
      }

      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeDoc.topic.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  }

  const canGenerate = isAdminPlus || (remaining !== null && remaining > 0);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "1.5rem 1rem" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1
          style={{
            fontSize: "1.6rem",
            fontWeight: 800,
            color: "var(--color-text)",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>✨</span> AI Generated Content
        </h1>
        <p style={{ color: "var(--color-text-muted)", marginTop: "0.35rem", fontSize: "0.9rem" }}>
          Generate AI-powered detailed exam notes with archive-first RAG + optional live web updates.
        </p>
      </div>

      {/* Quota badge */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.35rem 0.75rem",
          borderRadius: 9999,
          background: isFounder
            ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
            : remaining === 0
            ? "#fce8eb"
            : "var(--color-accent-soft)",
          color: isFounder ? "#fff" : remaining === 0 ? "var(--brand-crimson)" : "var(--color-text)",
          fontSize: "0.8rem",
          fontWeight: 600,
          marginBottom: "1.25rem",
        }}
      >
        {isFounder ? (
          <>👑 Founder – Unlimited generations</>
        ) : remaining === null ? (
          <>⏳ Loading quota…</>
        ) : (
          <>
            📄 {remaining}/{DAILY_LIMIT} generations remaining today
          </>
        )}
      </div>

      {/* Generator card */}
      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          padding: "1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        <label
          htmlFor="ai-topic"
          style={{ fontWeight: 600, fontSize: "0.875rem", display: "block", marginBottom: "0.5rem" }}
        >
          What topic should ExamBot generate detailed notes for?
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: "0.5rem", marginBottom: "0.6rem" }}>
          <label style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            Length (pages)
            <select
              value={String(pageLength)}
              onChange={(e) => setPageLength(Number(e.target.value))}
              disabled={generating || !canGenerate}
              className="input-field"
              style={{ marginTop: 4 }}
            >
              {pageOptions.map((p) => (
                <option key={p} value={String(p)}>
                  {p} page{p > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </label>
          <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
            <label style={{ display: "block", marginBottom: 4 }}>Model</label>
            <ModelSelect
              options={modelOptions}
              value={model}
              onChange={setModel}
              disabled={generating || !canGenerate}
            />
          </div>
          <label style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 6, marginTop: 18 }}>
            <input
              type="checkbox"
              checked={useWebSearch}
              onChange={(e) => setUseWebSearch(e.target.checked)}
              disabled={generating || !canGenerate}
            />
            Include live web search
          </label>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            id="ai-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canGenerate && generate()}
            placeholder="e.g. PHYDSC101T electrostatics derivation set, Indian Constitution federalism PYQ trend…"
            maxLength={500}
            disabled={generating || !canGenerate}
            className="input-field"
            style={{ flex: 1, minWidth: 200 }}
          />
          <button
            onClick={generate}
             disabled={generating || !topic.trim() || !canGenerate || !model}
             className="btn-primary"
             style={{ whiteSpace: "nowrap" }}
           >
             {generating ? `Generating… (${loadingStep})` : "✨ Generate Notes"}
           </button>
         </div>

        {!canGenerate && !isAdminPlus && (
          <p style={{ marginTop: "0.6rem", fontSize: "0.8rem", color: "var(--brand-crimson)" }}>
            Daily limit reached. Come back tomorrow for {DAILY_LIMIT} more generations.
          </p>
        )}

        {error && (
          <p style={{ marginTop: "0.6rem", fontSize: "0.8rem", color: "var(--brand-crimson)" }}>
            ⚠ {error}
          </p>
        )}

        {/* Quick topic suggestions */}
        <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {["Photosynthesis", "Ohm's Law", "Federalism", "Organic Chemistry Basics", "Newton's Laws"].map(
            (s) => (
              <button
                key={s}
                onClick={() => setTopic(s)}
                disabled={generating || !canGenerate}
                style={{
                  padding: "0.2rem 0.6rem",
                  fontSize: "0.75rem",
                  borderRadius: 9999,
                  border: "1px solid var(--color-border)",
                  background: "transparent",
                  cursor: generating || !canGenerate ? "not-allowed" : "pointer",
                  color: "var(--color-text-muted)",
                  transition: "border-color 0.15s",
                }}
              >
                {s}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Generated documents list + viewer */}
      {documents.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
          {/* Viewer */}
          {activeDoc && (
            <div
              style={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-lg)",
                padding: "1.25rem",
                position: "relative",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "1rem",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                    {activeDoc.topic}
                  </h2>
                  <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                    Generated {new Date(activeDoc.generatedAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={handlePrint}
                  className="btn"
                  style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}
                >
                  📥 Download PDF
                </button>
              </div>

              <div
                ref={printRef}
                style={{
                  fontSize: "0.875rem",
                  lineHeight: 1.7,
                  color: "var(--color-text)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {activeDoc.content}
              </div>
            </div>
          )}

          {/* Document history (if more than 1) */}
          {documents.length > 1 && (
            <div>
              <p style={{ fontWeight: 600, fontSize: "0.8rem", color: "var(--color-text-muted)", marginBottom: "0.5rem" }}>
                Session history
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {documents.map((doc, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveDoc(doc)}
                    style={{
                      textAlign: "left",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "var(--radius-sm)",
                      border: `1px solid ${activeDoc === doc ? "var(--brand-crimson)" : "var(--color-border)"}`,
                      background: activeDoc === doc ? "var(--color-accent-soft)" : "var(--color-surface)",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      color: "var(--color-text)",
                    }}
                  >
                    <strong>{doc.topic}</strong>
                    <span style={{ color: "var(--color-text-muted)", marginLeft: "0.5rem" }}>
                      {new Date(doc.generatedAt).toLocaleTimeString()}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {documents.length === 0 && !generating && (
        <div
          style={{
            textAlign: "center",
            padding: "3rem 1rem",
            color: "var(--color-text-muted)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: "0.75rem" }}>✨</div>
          <p style={{ fontWeight: 600 }}>No documents generated yet</p>
          <p style={{ fontSize: "0.85rem" }}>
             Enter a topic above and click <em>Generate Notes</em> to create your first AI study document.
           </p>
         </div>
       )}

      {/* Info box */}
      <div
        style={{
          marginTop: "2rem",
          padding: "1rem",
          background: "var(--color-accent-soft)",
          borderRadius: "var(--radius-md)",
          fontSize: "0.8rem",
          color: "var(--color-text-muted)",
          lineHeight: 1.6,
        }}
      >
         <strong style={{ color: "var(--color-text)" }}>ℹ How it works:</strong>{" "}
         ExamBot prioritizes your archive syllabus/paper context (including My Course preference when available),
         optionally adds live web updates, and generates detailed notes with revision-ready structure.
         Use the <em>Print / Save PDF</em> button to save the document. Generated content is for study
         reference only — always verify with official sources.{" "}
         {userRole !== "founder" && userRole !== "admin" && (
           <>
             You have a daily limit of <strong>{DAILY_LIMIT} documents</strong>. Need more? Browse
             real papers at <Link href="/browse" style={{ color: "var(--brand-crimson)" }}>/browse</Link>.
           </>
         )}
       </div>
    </div>
  );
}
