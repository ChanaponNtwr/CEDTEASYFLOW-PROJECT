"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ClassCard from "./_components/ClassCard";
import { apiGetLab } from "@/app/service/FlowchartService";
import { useSession } from "next-auth/react";
// เพิ่ม Icons เพื่อความสวยงาม
import { FaCheckDouble, FaTimes, FaFileImport, FaPlus, FaLayerGroup } from "react-icons/fa";

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
    // Toggle Select All / Deselect All logic
    if (selectedLabIds.length === displayLabs.length && displayLabs.length > 0) {
        setSelectedLabIds([]);
    } else {
        const allIds = displayLabs.map((l, idx) => String(l.labId ?? l.id ?? idx));
        setSelectedLabIds(allIds);
    }
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
        sessionStorage.removeItem("importMode");
      } catch {}

      if (importReturn) {
        const separator = importReturn.includes("?") ? "&" : "?";
        router.push(`${importReturn}${separator}openImport=true`);
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
    <div className="pt-20 min-h-screen bg-gray-50"> {/* เปลี่ยน bg เป็น gray-50 ให้อ่อนลงเล็กน้อย */}
      <div className="pl-60">
        <Navbar />
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col p-8 lg:p-20"> {/* ปรับ padding ให้สมดุล */}
            
            {/* Header Title Area */}
            <div className="flex items-center gap-3 mb-6">
                 <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
                     <FaLayerGroup size={28} />
                 </div>
                 <div>
                     <h1 className="text-3xl font-bold text-gray-800">Select Labs</h1>
                     <p className="text-gray-500 text-sm">Choose labs from your collection to import</p>
                 </div>
             </div>

            {/* ✅ NEW TOOLBAR: Control Bar Design */}
            <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 transition-all">
                
                {/* Left: Selection Controls */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={handleSelectAll}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border transition-all active:scale-95
                        ${selectedLabIds.length === displayLabs.length && displayLabs.length > 0
                            ? "bg-blue-50 border-blue-200 text-blue-700" 
                            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                    >
                        <FaCheckDouble className={selectedLabIds.length === displayLabs.length && displayLabs.length > 0 ? "text-blue-600" : "text-gray-400"} />
                        {selectedLabIds.length === displayLabs.length && displayLabs.length > 0 ? "Deselect All" : "Select All"}
                    </button>

                    {/* Show Clear button only when items selected */}
                    {selectedLabIds.length > 0 && (
                        <button
                            onClick={handleClearSelection}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 transition-all active:scale-95 animate-in fade-in zoom-in duration-200"
                        >
                            <FaTimes />
                            Clear
                        </button>
                    )}
                </div>

                {/* Center/Right: Actions & Counter */}
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    
                    {/* Selected Counter */}
                    <div className="hidden md:flex items-center gap-2 mr-2">
                        <span className="text-sm text-gray-500">Selected:</span>
                        <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full font-bold text-sm">
                            {selectedLabIds.length}
                        </span>
                    </div>

                    {/* Import/Confirm Button (Primary) */}
                    <button
                        onClick={handleConfirmSelect}
                        disabled={selectedLabIds.length === 0}
                        className={`
                            flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md transition-all
                            ${selectedLabIds.length > 0
                                ? "bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 shadow-blue-200"
                                : "bg-gray-300 cursor-not-allowed shadow-none"}
                        `}
                    >
                        <FaFileImport />
                        Import {selectedLabIds.length > 0 ? `(${selectedLabIds.length})` : ""}
                    </button>

                    {/* Create Lab Button (Secondary) */}
                    <button
                        onClick={handleCreateLab}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gray-800 rounded-xl hover:bg-gray-900 shadow-md transition-all active:scale-95"
                    >
                        <FaPlus size={12} />
                        Create Lab
                    </button>
                </div>
            </div>

            {loading && (
              <div className="mb-4 text-center text-gray-500 animate-pulse">
                Updating labs from server...
              </div>
            )}

            {error && (
              <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 text-center">
                {error}
              </div>
            )}

            {displayLabs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-300 text-gray-400">
                <FaLayerGroup size={48} className="mb-4 text-gray-200" />
                <p className="text-lg font-medium">No Labs Found</p>
                <p className="text-sm mb-6">Create a new lab to get started.</p>
                <button
                    onClick={handleCreateLab}
                    className="px-6 py-2 bg-blue-50 text-blue-600 rounded-full font-semibold hover:bg-blue-100 transition-colors"
                >
                    Create your first Lab
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
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