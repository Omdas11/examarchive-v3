"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ALL_DSC_DSM_SUBJECTS,
  ALL_IDC_SUBJECTS,
  AEC_OPTIONS,
  VAC_OPTIONS,
  DSM_ONLY_SUBJECTS,
  LITERATURE_SUBJECTS,
  saveCoursePrefs,
  type CoursePreferences,
} from "@/data/course-selection-data";

interface CourseSelectionModalProps {
  open: boolean;
  onClose: (saved: boolean) => void;
  initialPrefs?: CoursePreferences | null;
}

const STEPS = ["DSC", "DSM", "SEC", "IDC", "AEC & VAC"] as const;

type Step = 0 | 1 | 2 | 3 | 4;

const TITLE_ID = "course-selection-title";

function SubjectPill({
  label,
  selected,
  color = "primary",
  onClick,
}: {
  label: string;
  selected: boolean;
  color?: "primary" | "teal" | "green";
  onClick: () => void;
}) {
  const colorMap = {
    primary: { active: "var(--color-primary)", text: "#fff" },
    teal: { active: "var(--nav-teal)", text: "#fff" },
    green: { active: "var(--success-green)", text: "#fff" },
  } as const;

  const currentColor = colorMap[color];

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-sm font-medium transition-all"
      style={{
        border: `1.5px solid ${selected ? currentColor.active : "var(--color-border)"}`,
        background: selected ? currentColor.active : "var(--color-surface)",
        color: selected ? currentColor.text : "var(--color-text)",
      }}
    >
      {label}
    </button>
  );
}

function normalizeSubject(subject: string): string {
  return subject.toLowerCase().replace(/ and /g, " & ").trim();
}

export default function CourseSelectionModal({
  open,
  onClose,
  initialPrefs,
}: CourseSelectionModalProps) {
  const [step, setStep] = useState<Step>(0);
  const [dsc, setDsc] = useState(initialPrefs?.dsc ?? "");
  const [dsm1, setDsm1] = useState(initialPrefs?.dsm1 ?? "");
  const [dsm2, setDsm2] = useState(initialPrefs?.dsm2 ?? "");
  const [sec, setSec] = useState(initialPrefs?.sec ?? "");
  const [idc, setIdc] = useState(initialPrefs?.idc ?? "");
  const [aec, setAec] = useState(initialPrefs?.aec ?? "");
  const [vac, setVac] = useState(initialPrefs?.vac ?? "");

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDsc(initialPrefs?.dsc ?? "");
    setDsm1(initialPrefs?.dsm1 ?? "");
    setDsm2(initialPrefs?.dsm2 ?? "");
    setSec(initialPrefs?.sec ?? "");
    setIdc(initialPrefs?.idc ?? "");
    setAec(initialPrefs?.aec ?? "");
    setVac(initialPrefs?.vac ?? "");
  }, [open, initialPrefs]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  const dscIsLiterature = LITERATURE_SUBJECTS.includes(dsc);

  const dscOptions = ALL_DSC_DSM_SUBJECTS.filter(
    (subject) => !DSM_ONLY_SUBJECTS.includes(subject),
  );

  function dsmOptions(exclude: string[]): string[] {
    return ALL_DSC_DSM_SUBJECTS.filter((subject) => {
      if (exclude.includes(subject)) return false;
      if (dscIsLiterature && LITERATURE_SUBJECTS.includes(subject)) return false;
      return true;
    });
  }

  const dsm1Options = dsmOptions(dsc ? [dsc] : []);
  const dsm2Options = dsmOptions([dsc, dsm1].filter(Boolean));
  const secOptions = [dsc, dsm1].filter(Boolean);

  const idcOptions = ALL_IDC_SUBJECTS.filter((subject) => {
    const enrolled = [dsc, dsm1, dsm2, sec].filter(Boolean);
    if (enrolled.some((value) => normalizeSubject(value) === normalizeSubject(subject))) {
      return false;
    }
    if (dscIsLiterature && LITERATURE_SUBJECTS.includes(subject)) return false;
    return true;
  });

  function canAdvance(): boolean {
    switch (step) {
      case 0:
        return dsc !== "";
      case 1:
        return dsm1 !== "" && dsm2 !== "";
      case 2:
        return sec !== "";
      case 3:
        return idc !== "";
      case 4:
        return aec !== "" && vac !== "";
      default:
        return false;
    }
  }

  function handleDscSelect(subject: string) {
    setDsc(subject);
    const nextDsm1 =
      dsm1 === subject || (LITERATURE_SUBJECTS.includes(subject) && LITERATURE_SUBJECTS.includes(dsm1))
        ? ""
        : dsm1;
    if (nextDsm1 !== dsm1) setDsm1(nextDsm1);
    if (dsm2 === subject) setDsm2("");
    if (LITERATURE_SUBJECTS.includes(subject)) {
      if (LITERATURE_SUBJECTS.includes(dsm2)) setDsm2("");
    }
    if (sec && ![subject, nextDsm1].includes(sec)) {
      setSec("");
    }
  }

  function handleDsm1Select(subject: string) {
    setDsm1(subject);
    if (dsm2 === subject) setDsm2("");
    if (sec && ![dsc, subject].includes(sec)) {
      setSec("");
    }
  }

  function handleSave() {
    saveCoursePrefs({
      dsc,
      dsm1,
      dsm2,
      sec,
      idc,
      aec,
      vac,
      savedAt: new Date().toISOString(),
    });
    onClose(true);
  }

  if (!open) return null;

  function renderStep() {
    switch (step) {
      case 0:
        return (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Choose your <strong>DSC</strong> (Discipline Specific Core) directly from the subject list.
            </p>
            <div className="flex flex-wrap gap-2">
              {dscOptions.map((subject) => (
                <SubjectPill
                  key={subject}
                  label={subject}
                  selected={dsc === subject}
                  onClick={() => handleDscSelect(subject)}
                />
              ))}
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Choose <strong>two DSM</strong> (Discipline Specific Minor) subjects. They must differ from your DSC ({dsc}) and from each other.
            </p>
            {dscIsLiterature && (
              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: "var(--color-accent-soft)",
                  color: "var(--color-primary)",
                  border: "1px solid var(--color-primary)",
                }}
              >
                ℹ️ Since your DSC is a literature subject, other literature subjects are excluded from DSM selection.
              </div>
            )}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                First Minor (DSM 1)
              </p>
              <div className="flex flex-wrap gap-2">
                {dsm1Options.map((subject) => (
                  <SubjectPill
                    key={subject}
                    label={subject}
                    selected={dsm1 === subject}
                    onClick={() => handleDsm1Select(subject)}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
                Second Minor (DSM 2)
              </p>
              <div className="flex flex-wrap gap-2">
                {dsm2Options.map((subject) => (
                  <SubjectPill
                    key={subject}
                    label={subject}
                    selected={dsm2 === subject}
                    color="teal"
                    onClick={() => setDsm2(subject)}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Choose your <strong>SEC</strong> (Skill Enhancement Course). As requested, it can be selected from your DSC and DSM 1 choices.
            </p>
            <div className="flex flex-wrap gap-2">
              {secOptions.map((subject) => (
                <SubjectPill
                  key={subject}
                  label={subject}
                  selected={sec === subject}
                  color="green"
                  onClick={() => setSec(subject)}
                />
              ))}
              {secOptions.length === 0 && (
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  Select DSC and DSM 1 first to choose an SEC.
                </p>
              )}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              Choose your <strong>IDC</strong> (Interdisciplinary Course) directly from the full subject list.
            </p>
            {dscIsLiterature && (
              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: "var(--color-accent-soft)",
                  color: "var(--color-primary)",
                  border: "1px solid var(--color-primary)",
                }}
              >
                ℹ️ Literature subjects are excluded from IDC since your DSC is a literature subject.
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {idcOptions.map((subject) => (
                <SubjectPill
                  key={subject}
                  label={subject}
                  selected={idc === subject}
                  color="green"
                  onClick={() => setIdc(subject)}
                />
              ))}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-semibold">
                AEC <span className="font-normal text-xs" style={{ color: "var(--color-text-muted)" }}>(Ability Enhancement Course)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {AEC_OPTIONS.map((option) => (
                  <SubjectPill
                    key={option}
                    label={option}
                    selected={aec === option}
                    onClick={() => setAec(option)}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">
                VAC <span className="font-normal text-xs" style={{ color: "var(--color-text-muted)" }}>(Value Added Course)</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {VAC_OPTIONS.map((option) => (
                  <SubjectPill
                    key={option}
                    label={option}
                    selected={vac === option}
                    color="teal"
                    onClick={() => setVac(option)}
                  />
                ))}
              </div>
            </div>
            <div
              className="rounded-lg p-3 text-xs space-y-1"
              style={{
                background: "color-mix(in srgb, var(--nav-teal) 6%, var(--color-surface))",
                border: "1px solid var(--color-border)",
              }}
            >
              <p className="font-semibold text-sm mb-2">Your Course Selection</p>
              {[
                { label: "DSC", value: dsc },
                { label: "DSM 1", value: dsm1 },
                { label: "DSM 2", value: dsm2 },
                { label: "SEC", value: sec },
                { label: "IDC", value: idc },
                { label: "AEC", value: aec },
                { label: "VAC", value: vac },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2">
                  <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
                  <span className="font-medium">{value || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="confirm-modal-backdrop" aria-hidden="true" onClick={() => onClose(false)}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-surface)",
          border: "2px solid var(--color-primary)",
          borderRadius: "var(--radius-lg)",
          padding: "1.5rem",
          maxWidth: 560,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id={TITLE_ID} className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>
              Course Selection Setup
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            className="shrink-0 rounded-full p-1 transition-opacity hover:opacity-70"
            aria-label="Close"
            style={{ color: "var(--color-text-muted)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex gap-1.5 mb-5">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className="flex-1 h-1.5 rounded-full transition-colors"
              style={{
                background:
                  i < step
                    ? "var(--color-primary)"
                    : i === step
                      ? "var(--nav-teal)"
                      : "var(--color-border)",
              }}
              aria-hidden="true"
            />
          ))}
        </div>

        {renderStep()}

        <div className="mt-5 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button type="button" onClick={() => setStep((current) => (current - 1) as Step)} className="btn text-sm px-4 py-2">
              ← Back
            </button>
          ) : (
            <button type="button" onClick={() => onClose(false)} className="btn text-sm px-4 py-2">
              Skip for now
            </button>
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((current) => (current + 1) as Step)}
              disabled={!canAdvance()}
              className="btn-primary text-sm px-5 py-2 disabled:opacity-40"
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={!canAdvance()}
              className="btn-primary text-sm px-5 py-2 disabled:opacity-40"
            >
              Save My Courses
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
