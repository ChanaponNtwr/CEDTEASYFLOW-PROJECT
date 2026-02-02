"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ClassCard from "./_components/ClassCard";
import { apiGetLab } from "@/app/service/FlowchartService";
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
  author?: string;
  teacher?: string;
  authorEmail?: string; 
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
  const { data: session, status } = useSession();

  const [labs, setLabs] = useState<LocalLab[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedLabIds, setSelectedLabIds] = useState<string[]>([]);

  const [importForm, setImportForm] = useState<any | null>(null);
  const [importMode, setImportMode] = useState(false);
  const [importReturn, setImportReturn] = useState<string | null>(null);

  const router = useRouter();

  /* =======================
      Load labs
  ======================== */
  useEffect(() => {
    if (status === "loading") return;
    
    const currentUserEmail = session?.user?.email;
    if (!currentUserEmail) {
      setLabs([]);
      return;
    }

    let allLabs: LocalLab[] = [];
    try {
      const stored = localStorage.getItem("labs");
      allLabs = stored ? JSON.parse(stored) : [];
      
      const myLabs = allLabs.filter(l => l.authorEmail === currentUserEmail);
      setLabs(myLabs);

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
    } catch {
      setLabs([]);
    }

    const myLabs = allLabs.filter(l => l.authorEmail === currentUserEmail);
    const remoteLabs = myLabs.filter((l) => l.labId !== undefined && l.labId !== null);
    
    if (remoteLabs.length === 0) return;

    let mounted = true;
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

        const storedNow = localStorage.getItem("labs");
        const currentAllLabs: LocalLab[] = storedNow ? JSON.parse(storedNow) : [];
        let anyUpdated = false;

        const updatedAllLabs = currentAllLabs.map((existingLab) => {
          const matchResult = results.find(
            r => r.ok && String(r.labId) === String(existingLab.labId)
          );
            
          if (matchResult && matchResult.remoteLab && existingLab.authorEmail === currentUserEmail) {
            anyUpdated = true;
            return {
              ...existingLab,
              ...matchResult.remoteLab
            };
          }
          return existingLab;
        });

        if (anyUpdated) {
          const updatedMyLabs = updatedAllLabs.filter(l => l.authorEmail === currentUserEmail);
          setLabs(updatedMyLabs);
          try {
            localStorage.setItem("labs", JSON.stringify(updatedAllLabs));
          } catch {}
        }
      } catch {
        setError("Failed to fetch remote labs");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchRemote();
    return () => {
      mounted = false;
    };
  }, [session, status]);

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
      Create Lab
  ======================== */
  const handleCreateLab = () => {
    router.push("/createlab");
  };

  /* =======================
      Confirm (Select)
  ======================== */
  const handleConfirmSelect = () => {
    if (selectedLabIds.length === 0) return;

    if (importMode) {
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
      } catch {}

      try {
        sessionStorage.removeItem("importForm");
        sessionStorage.removeItem("importMode");
      } catch {}

      if (importReturn) {
        router.push(importReturn);
      } else {
        router.back();
      }
      return;
    }

    router.push(`/Classwork?labIds=${encodeURIComponent(selectedLabIds.join(","))}`);
  };

  /* =======================
      Open lab info
  ======================== */
  const handleOpenLab = (labId: string) => {
    router.push(`/labinfo/${encodeURIComponent(labId)}`);
  };

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <div className="pl-60">
        <Navbar />
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col p-20">
            {/* Control Bar */}
            <div className="flex items-center justify-end gap-4 mb-4">
              {/* Existing controls */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1 rounded-md bg-gray-100 text-sm hover:bg-gray-200"
                >
                  Select all
                </button>
                <button
                  onClick={handleClearSelection}
                  className="px-3 py-1 rounded-md bg-gray-100 text-sm hover:bg-gray-200"
                >
                  Clear
                </button>
              </div>

              <div className="text-sm text-gray-700">
                {selectedLabIds.length} selected
              </div>

              <button
                onClick={handleConfirmSelect}
                disabled={selectedLabIds.length === 0}
                className={`px-6 py-2 rounded-4xl flex items-center text-white transition-all duration-200 ${
                  selectedLabIds.length > 0
                    ? "bg-[#0D3ACE] hover:bg-[#0B2EA6] shadow-lg"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                Select
              </button>

              {/* Create Lab (RIGHT MOST) */}
              <button
                onClick={handleCreateLab}
                className="px-4 py-2 rounded-md bg-[#0D3ACE] text-white text-sm hover:bg-[#0B2EA6] shadow"
              >
                + Create Lab
              </button>
            </div>

            <h2 className="text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-4">
              My Labs{" "}
              <span className="text-sm font-normal text-gray-500">
                (User: {session?.user?.name})
              </span>
            </h2>

            {loading && (
              <div className="mb-4 text-sm text-gray-600">
                กำลังอัปเดตข้อมูลจากเซิร์ฟเวอร์...
              </div>
            )}

            {error && (
              <div className="mb-4 text-sm text-red-600">{error}</div>
            )}

            {displayLabs.length === 0 ? (
              <div className="p-6 text-gray-600">
                ยังไม่มี Lab กด Create Lab เพื่อสร้างใหม่
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayLabs.map((lab, index) => {
                  const labId = String(lab.labId ?? lab.id ?? index);
                  const name =
                    lab.labname ?? lab.labName ?? lab.name ?? "Untitled Lab";
                  const problem =
                    lab.problemSolving ?? lab.problem ?? "";
                  const due = formatThaiDate(
                    lab.dueDate ?? lab.dateline
                  );
                  const testcases =
                    lab.testcases ?? lab.testCases ?? [];
                  const totalScore = calcTotalScore(testcases);

                  const teacherName =
                    lab.author ||
                    lab.teacher ||
                    session?.user?.name ||
                    "Unknown Teacher";

                  return (
                    <div key={labId} className="block">
                      <ClassCard
                        title={name}
                        teacher={teacherName}
                        score={totalScore}
                        due={due}
                        problem={problem || "—"}
                        isChecked={selectedLabIds.includes(labId)}
                        onCheckboxChange={(checked) =>
                          handleToggleSelect(labId, checked)
                        }
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
