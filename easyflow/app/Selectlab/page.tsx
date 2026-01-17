"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ClassCard from "./_components/ClassCard";
import { apiGetLab } from "@/app/service/FlowchartService";
// 1. Import useSession
import { useSession } from "next-auth/react";

/* =======================
   Types
======================= */
type LocalLab = {
  id?: number;
  labId?: number | string;
  name?: string;
  labname?: string;
  labName?: string;
  dateline?: string;
  dueDate?: string;
  problem?: string;
  problemSolving?: string;
  testCases?: any[];
  testcases?: any[];
  createdAt?: string;
  // เพิ่ม field author/teacher เผื่อ API ส่งมา
  author?: string;
  teacher?: string;
};

/* =======================
   Helpers
======================= */
function formatThaiDate(d?: string) {
  if (!d) return "ไม่กำหนดวันส่ง";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function calcTotalScore(testcases?: any[]) {
  if (!Array.isArray(testcases)) return 0;
  return testcases.reduce((sum, tc) => {
    const s = Number(tc?.score);
    return sum + (isNaN(s) ? 0 : s);
  }, 0);
}

export default function Selectlab() {
  // 2. ดึงข้อมูล Session
  const { data: session } = useSession();

  const [labs, setLabs] = useState<LocalLab[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // multi-select
  const [selectedLabIds, setSelectedLabIds] = useState<string[]>([]);

  // import flow (from ImportLabModal)
  const [importForm, setImportForm] = useState<any | null>(null);
  const [importMode, setImportMode] = useState(false);
  const [importReturn, setImportReturn] = useState<string | null>(null);

  const router = useRouter();

  /* =======================
      Load local labs + remote update
  ======================== */
  useEffect(() => {
    // load stored labs
    try {
      const stored = localStorage.getItem("labs");
      const parsed: LocalLab[] = stored ? JSON.parse(stored) : [];
      setLabs(parsed);

      // Check import-mode data in sessionStorage
      const rawForm = sessionStorage.getItem("importForm");
      const mode = sessionStorage.getItem("importMode");
      const ret = sessionStorage.getItem("importReturn");

      if (rawForm) {
        try {
          setImportForm(JSON.parse(rawForm));
        } catch {
          setImportForm(null);
        }
      }
      if (mode) setImportMode(true);
      if (ret) setImportReturn(ret);
    } catch (err) {
      // ignore parse/storage errors
      setLabs([]);
    }

    // fetch remote labs that have labId
    let mounted = true;
    const local = (() => {
      try {
        const stored = localStorage.getItem("labs");
        return stored ? (JSON.parse(stored) as LocalLab[]) : [];
      } catch {
        return [];
      }
    })();

    const remoteLabs = local.filter((l) => l.labId !== undefined && l.labId !== null);
    if (remoteLabs.length === 0) return;

    const fetchRemote = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.all(
          remoteLabs.map(async (l) => {
            try {
              const resp = await apiGetLab(String(l.labId));
              const remoteLab = (resp && (resp.lab ?? resp)) || null;
              return { ok: true, labId: l.labId, remoteLab };
            } catch {
              return { ok: false, labId: l.labId };
            }
          })
        );

        if (!mounted) return;

        const updated = [...local];
        let anyUpdated = false;

        results.forEach((r) => {
          if (r.ok && r.remoteLab) {
            const idx = updated.findIndex(
              (x) => String(x.labId) === String(r.labId)
            );
            if (idx !== -1) {
              updated[idx] = {
                ...updated[idx],
                ...r.remoteLab,
              };
              anyUpdated = true;
            }
          }
        });

        if (anyUpdated) {
          setLabs(updated);
          try {
            localStorage.setItem("labs", JSON.stringify(updated));
          } catch {
            // ignore storage error
          }
        }
      } catch (err) {
        setError("Failed to fetch remote labs");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchRemote();
    return () => {
      mounted = false;
    };
  }, []);

  /* =======================
      Sort newest first
  ======================== */
  const displayLabs = [...labs].sort((a, b) => {
    const da = new Date(a.createdAt ?? (a.id ?? 0)).getTime();
    const db = new Date(b.createdAt ?? (b.id ?? 0)).getTime();
    return db - da;
  });

  /* =======================
      Selection handlers
  ======================== */
  const handleToggleSelect = (labId: string, checked: boolean) => {
    setSelectedLabIds((prev) => {
      if (checked) return Array.from(new Set([...prev, labId]));
      return prev.filter((id) => id !== labId);
    });
  };

  const handleSelectAll = () => {
    const allIds = displayLabs.map((l, idx) => String(l.labId ?? l.id ?? idx));
    setSelectedLabIds(allIds);
  };

  const handleClearSelection = () => {
    setSelectedLabIds([]);
  };

  /* =======================
      Confirm (Select) button
  ======================== */
  const handleConfirmSelect = () => {
    if (selectedLabIds.length === 0) return;

    if (importMode) {
      // Build payload for import modal
      const selectedLabs = selectedLabIds.map((id) => {
        const found = displayLabs.find((l) => String(l.labId ?? l.id) === id);
        const name = found ? (found.labname ?? found.labName ?? found.name ?? `Lab ${id}`) : id;
        return { labId: id, name };
      });

      const payload = {
        labIds: selectedLabIds,
        labs: selectedLabs,
        formData: importForm,
      };

      try {
        sessionStorage.setItem("selectedImportedLabs", JSON.stringify(payload));
      } catch {
        // ignore storage errors
      }

      // clean up import flags so we don't reuse them accidentally
      try {
        sessionStorage.removeItem("importForm");
        sessionStorage.removeItem("importMode");
      } catch {}

      // navigate back to caller (or router.back())
      if (importReturn) {
        router.push(importReturn);
      } else {
        router.back();
      }
      return;
    }

    // Normal flow (not import-mode): go to Classwork with labIds csv
    router.push(`/Classwork?labIds=${encodeURIComponent(selectedLabIds.join(","))}`);
  };

  /* =======================
      Open lab info when card clicked
  ======================== */
  const handleOpenLab = (labId: string) => {
    router.push(`/labinfo?labId=${encodeURIComponent(labId)}`);
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <div className="pl-60">
        <Navbar />
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col p-20">
            {/* Control Bar (Select Actions) */}
            <div className="flex items-center justify-end gap-4 mb-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1 rounded-md bg-gray-100 text-sm hover:bg-gray-200"
                  title="Select all"
                >
                  Select all
                </button>
                <button
                  onClick={handleClearSelection}
                  className="px-3 py-1 rounded-md bg-gray-100 text-sm hover:bg-gray-200"
                  title="Clear selection"
                >
                  Clear
                </button>
              </div>

              <div className="text-sm text-gray-700">{selectedLabIds.length} selected</div>

              <button
                onClick={handleConfirmSelect}
                disabled={selectedLabIds.length === 0}
                className={`px-6 py-2 rounded-4xl flex items-center text-white transition-all duration-200 ${selectedLabIds.length > 0 ? "bg-[#0D3ACE] hover:bg-[#0B2EA6] shadow-lg" : "bg-gray-300 cursor-not-allowed"}`}
              >
                Select
              </button>
            </div>

            <h2 className="text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-4">My Labs</h2>

            {loading && <div className="mb-4 text-sm text-gray-600">กำลังอัปเดตข้อมูลจากเซิร์ฟเวอร์...</div>}

            {error && <div className="mb-4 text-sm text-red-600">{error}</div>}

            {displayLabs.length === 0 ? (
              <div className="p-6 text-gray-600">ยังไม่มี Lab กด Create Lab เพื่อสร้างใหม่</div>
            ) : (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayLabs.map((lab, index) => {
                  const labId = String(lab.labId ?? lab.id ?? index);
                  const name = lab.labname ?? lab.labName ?? lab.name ?? "Untitled Lab";
                  const problem = lab.problemSolving ?? lab.problem ?? "";
                  const due = formatThaiDate(lab.dueDate ?? lab.dateline);
                  const testcases = lab.testcases ?? lab.testCases ?? [];
                  const totalScore = calcTotalScore(testcases);

                  // 3. กำหนดชื่อผู้สร้าง (Logic เดียวกับ Mylab)
                  const teacherName = 
                    lab.author || 
                    lab.teacher || 
                    session?.user?.name || 
                    "Unknown Teacher";

                  return (
                    <div key={labId} className="block">
                      <ClassCard
                        title={name}
                        // ส่งชื่อ teacher ไปที่ Card
                        teacher={teacherName} 
                        score={totalScore}
                        due={due}
                        problem={problem || "—"}
                        // Props สำหรับการเลือก (ยังคงไว้)
                        isChecked={selectedLabIds.includes(labId)}
                        onCheckboxChange={(checked) => handleToggleSelect(labId, checked)}
                        onCardClick={() => handleOpenLab(labId)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}