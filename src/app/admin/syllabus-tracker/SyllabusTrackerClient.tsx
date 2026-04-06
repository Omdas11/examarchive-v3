"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SlotKey = "dsc1" | "dsc2" | "dsc3" | "dsc4" | "dsm1" | "dsm2" | "idc" | "sec" | "vac" | "aec";
const SLOT_KEYS = new Set<SlotKey>(["dsc1", "dsc2", "dsc3", "dsc4", "dsm1", "dsm2", "idc", "sec", "vac", "aec"]);

function isSlotKey(value: string): value is SlotKey {
  return SLOT_KEYS.has(value as SlotKey);
}

interface SlotEntry {
  code: string | null;
  name: string | null;
  label: string;
}

interface CurriculumRow {
  sr: number;
  semester: number;
  total: number | null;
  slots: Record<SlotKey, SlotEntry>;
}

interface CurriculumTable {
  id: string;
  label: string;
  rows: CurriculumRow[];
}

interface SlotOrderItem {
  key: string;
  label: string;
}

interface Props {
  tables: CurriculumTable[];
  slotOrder: SlotOrderItem[];
  uploadedMap: Record<string, string | null>;
  totalExpected: number;
  canEdit: boolean;
}

const CHECKED_STORAGE_KEY = "syllabus-tracker-checked-v1";
const LINKED_CHECK_GROUPS: string[][] = [["ENGAEC151T", "ENGAEC251T"]];

const SLOT_BG: Record<SlotKey, string> = {
  dsc1: "bg-blue-50 dark:bg-blue-900/25",
  dsc2: "bg-blue-50 dark:bg-blue-900/25",
  dsc3: "bg-blue-50 dark:bg-blue-900/25",
  dsc4: "bg-blue-50 dark:bg-blue-900/25",
  dsm1: "bg-purple-50 dark:bg-purple-900/25",
  dsm2: "bg-purple-50 dark:bg-purple-900/25",
  idc: "bg-orange-50 dark:bg-orange-900/25",
  sec: "bg-amber-50 dark:bg-amber-900/25",
  vac: "bg-green-50 dark:bg-green-900/25",
  aec: "bg-red-50 dark:bg-red-900/25",
};

function getIsUploaded(code: string | null, uploadedMap: Record<string, string | null>): boolean {
  return Boolean(code && code in uploadedMap);
}

function PaperCell({
  code,
  label,
  uploaded,
  checked,
  onToggle,
  disabled,
  highlighted,
  refEl,
  bgClass,
}: {
  code: string | null;
  label: string;
  uploaded: boolean;
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
  highlighted: boolean;
  refEl?: React.Ref<HTMLTableCellElement>;
  bgClass: string;
}) {
  if (!code) {
    return <td className="border border-outline-variant/30 bg-surface-container-low p-2 text-center text-on-surface-variant">—</td>;
  }

  const ring = highlighted ? "ring-2 ring-primary ring-inset motion-safe:animate-pulse" : "";
  return (
    <td
      ref={refEl}
      className={`border border-outline-variant/30 p-1.5 align-top ${bgClass} ${ring}`}
      title={`${label}: ${code}`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          aria-label={`Check ${code}`}
          checked={checked}
          onChange={onToggle}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 rounded border-outline-variant"
        />
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold leading-tight break-all">{code}</p>
          <p className={`text-[10px] ${uploaded ? "text-green-700 dark:text-green-400" : "text-on-surface-variant"}`}>
            {uploaded ? "Uploaded" : "Pending"}
          </p>
        </div>
      </div>
    </td>
  );
}

export default function SyllabusTrackerClient({ tables, slotOrder, uploadedMap, totalExpected, canEdit }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const highlightCode = searchParams.get("highlight")?.toUpperCase() ?? null;

  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  const highlightRef = useRef<HTMLTableCellElement | null>(null);
  const normalizedSlotOrder = useMemo(
    () => slotOrder.filter((slot): slot is { key: SlotKey; label: string } => isSlotKey(slot.key)),
    [slotOrder],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHECKED_STORAGE_KEY);
      if (raw) setCheckedMap(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      // ignore parse/storage errors
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CHECKED_STORAGE_KEY, JSON.stringify(checkedMap));
    } catch {
      // ignore storage errors
    }
  }, [checkedMap]);

  useEffect(() => {
    if (highlightCode && highlightRef.current) {
      const id = setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 250);
      return () => clearTimeout(id);
    }
  }, [highlightCode, checkedMap]);

  const clearHighlight = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete("highlight");
    router.replace(url.pathname + url.search);
  }, [router]);

  const allCodes = useMemo(() => {
    const codes: string[] = [];
    for (const table of tables) {
      for (const row of table.rows) {
        for (const slot of normalizedSlotOrder) {
          const code = row.slots[slot.key]?.code;
          if (code) codes.push(code);
        }
      }
    }
    return Array.from(new Set(codes));
  }, [tables, normalizedSlotOrder]);

  const uploadedCount = useMemo(
    () => allCodes.filter((code) => code in uploadedMap).length,
    [allCodes, uploadedMap],
  );

  const checkedCount = useMemo(
    () => allCodes.filter((code) => checkedMap[code]).length,
    [allCodes, checkedMap],
  );

  const masterRows = useMemo(() => {
    const semesters = [1, 2, 3, 4, 5, 6, 7, 8];
    return semesters.map((semester) => {
      const semesterCodes = allCodes.filter((code) => {
        for (const table of tables) {
          for (const row of table.rows) {
            if (row.semester !== semester) continue;
            for (const slot of normalizedSlotOrder) {
              if (row.slots[slot.key]?.code === code) return true;
            }
          }
        }
        return false;
      });
      const checked = semesterCodes.filter((c) => checkedMap[c]).length;
      const uploaded = semesterCodes.filter((c) => c in uploadedMap).length;
      return { semester, total: semesterCodes.length, checked, uploaded };
    });
  }, [allCodes, tables, normalizedSlotOrder, checkedMap, uploadedMap]);
  const masterByDepartment = useMemo(
    () =>
      tables.map((table) => {
        const bySemester = [1, 2, 3, 4, 5, 6, 7, 8].map((semester) => {
          const codes = table.rows
            .filter((r) => r.semester === semester)
            .flatMap((r) =>
              normalizedSlotOrder.map((s) => r.slots[s.key]?.code).filter(Boolean) as string[],
            );
          const checkedCount = codes.filter((c) => checkedMap[c]).length;
          const checked = codes.length > 0 && checkedCount === codes.length;
          return { semester, total: codes.length, checked, checkedCount };
        });
        return { id: table.id, label: table.label, bySemester };
      }),
    [tables, normalizedSlotOrder, checkedMap],
  );

  function toggleCode(code: string) {
    if (!canEdit) return;
    const linked = LINKED_CHECK_GROUPS.find((group) => group.includes(code)) ?? [code];
    setCheckedMap((prev) => {
      const nextValue = !prev[code];
      const updated = { ...prev };
      for (const targetCode of linked) updated[targetCode] = nextValue;
      return updated;
    });
  }

  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          View-only mode: only admin+ roles can update checklist states.
        </div>
      )}
      <div className="rounded-xl border border-outline-variant/30 bg-surface p-4 shadow-sm">
        <p className="text-sm font-semibold">
          Uploaded: <span className="text-primary">{uploadedCount}/{totalExpected}</span> · Checked:{" "}
          <span className="text-primary">{checkedCount}/{totalExpected}</span>
        </p>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface-container-low">
          <div className="h-full bg-primary" style={{ width: `${Math.min(100, (uploadedCount / totalExpected) * 100)}%` }} />
        </div>
      </div>

      {highlightCode && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="text-primary">✦</span>
          <span>
            Highlighting <strong className="font-mono">{highlightCode}</strong>
          </span>
          <button onClick={clearHighlight} className="ml-auto text-xs text-on-surface-variant hover:text-on-surface">
            Clear
          </button>
        </div>
      )}

      <section className="rounded-xl border border-outline-variant/30 bg-surface shadow-sm">
        <div className="border-b border-outline-variant/30 px-4 py-3">
          <h2 className="text-base font-semibold">Master Table (Auto summary from individual checks)</h2>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="min-w-[1100px] w-full text-left text-xs">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="border border-outline-variant/30 px-2 py-2">Department</th>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                  <th key={s} className="border border-outline-variant/30 px-2 py-2 text-center">
                    Sem {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {masterByDepartment.map((dept) => (
                <tr key={dept.id}>
                  <td className="border border-outline-variant/30 px-2 py-2 font-semibold">{dept.label}</td>
                  {dept.bySemester.map((s) => (
                    <td key={`${dept.id}-${s.semester}`} className="border border-outline-variant/30 px-2 py-2 text-center">
                      {s.total === 0 ? (
                        <span className="text-on-surface-variant">—</span>
                      ) : (
                        <div className="space-y-1">
                          <label className="inline-flex items-center gap-1.5">
                            <input type="checkbox" checked={s.checked} readOnly className="h-4 w-4" />
                            <span className="text-[10px] text-on-surface-variant">
                              {s.checkedCount}/{s.total}
                            </span>
                          </label>
                          <div className="mx-auto h-1.5 w-14 overflow-hidden rounded-full bg-surface-container-low">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(100, (s.checkedCount / s.total) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-surface-container-low/60">
                <td className="border border-outline-variant/30 px-2 py-2 font-semibold">Overall</td>
                {masterRows.map((r) => (
                  <td key={`overall-${r.semester}`} className="border border-outline-variant/30 px-2 py-2 text-center">
                    <span className="text-[10px]">
                      {r.checked}/{r.total}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="space-y-6">
        {tables.map((table) => {
          const tableCodes = table.rows.flatMap((row) =>
            normalizedSlotOrder.map((s) => row.slots[s.key]?.code).filter(Boolean) as string[],
          );
          const checked = tableCodes.filter((c) => checkedMap[c]).length;
          return (
            <section key={table.id} className="rounded-xl border border-outline-variant/30 bg-surface shadow-sm">
              <div className="flex items-center justify-between border-b border-outline-variant/30 px-4 py-3">
                <h3 className="text-base font-semibold">{table.label} Department ({table.id})</h3>
                <span className="text-xs text-on-surface-variant">{checked}/{tableCodes.length} checked</span>
              </div>
              <div className="p-4 overflow-x-auto">
                <table className="min-w-[1400px] w-full text-left text-xs">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="border border-outline-variant/30 px-2 py-2">Sr</th>
                      <th className="border border-outline-variant/30 px-2 py-2">Semester</th>
                      {normalizedSlotOrder.map((slot) => (
                        <th key={slot.key} className="border border-outline-variant/30 px-2 py-2">{slot.label}</th>
                      ))}
                      <th className="border border-outline-variant/30 px-2 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr key={`${table.id}-${row.semester}`}>
                        <td className="border border-outline-variant/30 px-2 py-2">{row.sr}</td>
                        <td className="border border-outline-variant/30 px-2 py-2 font-semibold">Semester {row.semester}</td>
                        {normalizedSlotOrder.map((slot) => {
                          const entry = row.slots[slot.key];
                          const code = entry?.code ?? null;
                          const uploaded = getIsUploaded(code, uploadedMap);
                          const isChecked = Boolean(code && checkedMap[code]);
                          const highlighted = Boolean(code && highlightCode && code === highlightCode);
                          return (
                            <PaperCell
                              key={`${table.id}-${row.semester}-${slot.key}`}
                              code={code}
                              label={slot.label}
                              uploaded={uploaded}
                              checked={isChecked}
                              onToggle={() => code && toggleCode(code)}
                              highlighted={highlighted}
                              refEl={highlighted ? highlightRef : undefined}
                              bgClass={SLOT_BG[slot.key]}
                              disabled={!canEdit}
                            />
                          );
                        })}
                        <td className="border border-outline-variant/30 px-2 py-2 text-center font-semibold">{row.total ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
