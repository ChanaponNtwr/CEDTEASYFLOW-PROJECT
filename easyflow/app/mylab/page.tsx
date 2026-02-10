"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ClassCard from "./_components/ClassCard";
import { apiGetLab, apiDeleteLab } from "@/app/service/FlowchartService";
import { useSession } from "next-auth/react";
import { FaPlus, FaCube } from "react-icons/fa";

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

function Mylab() {
  const { data: session, status } = useSession();
  const [labs, setLabs] = useState<LocalLab[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserEmail = session?.user?.email;

  /* =======================
       Load labs
   ======================= */
  useEffect(() => {
    if (status === "loading") return;
    if (!currentUserEmail) {
      setLabs([]);
      return;
    }

    const stored = localStorage.getItem("labs");
    const allLabs: LocalLab[] = stored ? JSON.parse(stored) : [];

    const myLabs = allLabs.filter((lab) => lab.authorEmail === currentUserEmail);
    // โหลดข้อมูล Local มาโชว์ก่อน (ถ้าต้องการให้ Loading หมุนตลอดจนกว่า Server จะตอบกลับ ให้คอมเมนต์บรรทัดนี้ออก)
    setLabs(myLabs);

    const remoteLabs = myLabs.filter(
      (l) => l.labId !== undefined && l.labId !== null
    );

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
              const remoteLab = resp?.lab ?? resp;
              return { ok: true, labId: l.labId, remoteLab };
            } catch {
              return { ok: false, labId: l.labId };
            }
          })
        );

        if (!mounted) return;

        const currentLocalStorageAll = stored ? JSON.parse(stored) : [];
        let anyUpdated = false;

        const updatedAllLabs = currentLocalStorageAll.map(
          (localLab: LocalLab) => {
            const matchResult = results.find(
              (r) => r.ok && String(r.labId) === String(localLab.labId)
            );

            if (matchResult && matchResult.remoteLab) {
              anyUpdated = true;
              return {
                ...localLab,
                ...matchResult.remoteLab,
              };
            }
            return localLab;
          }
        );

        if (anyUpdated) {
          const updatedMyLabs = updatedAllLabs.filter(
            (l: LocalLab) => l.authorEmail === currentUserEmail
          );
          setLabs(updatedMyLabs);
          localStorage.setItem("labs", JSON.stringify(updatedAllLabs));
        }
      } catch (err) {
        console.error(err);
        setError("Failed to fetch remote labs");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchRemote();

    return () => {
      mounted = false;
    };
  }, [currentUserEmail, status]);

  /* =======================
       Sort newest first
   ======================= */
  const displayLabs = [...labs].sort((a, b) => {
    const da = new Date(a.createdAt ?? a.id ?? 0).getTime();
    const db = new Date(b.createdAt ?? b.id ?? 0).getTime();
    return db - da;
  });

  /* =======================
       Delete Lab (My Lab)
   ======================= */
  const handleDeleteLab = async (labId: string | number) => {
    const userId = (session?.user as any)?.id || (session?.user as any)?.userId;
    if (!userId) {
      alert("ไม่พบข้อมูลผู้ใช้ กรุณา Login ใหม่");
      return;
    }

    if (
      !confirm(
        "คุณต้องการลบ Lab นี้ถาวรใช่หรือไม่?\nการกระทำนี้ไม่สามารถย้อนกลับได้"
      )
    )
      return;

    try {
      await apiDeleteLab(String(labId), userId);
      setLabs((prev) =>
        prev.filter((l) => String(l.labId ?? l.id) !== String(labId))
      );

      const stored = localStorage.getItem("labs");
      const allLabs: LocalLab[] = stored ? JSON.parse(stored) : [];
      const updatedAll = allLabs.filter(
        (l) => String(l.labId ?? l.id) !== String(labId)
      );
      localStorage.setItem("labs", JSON.stringify(updatedAll));
    } catch (err: any) {
      console.error("Delete lab failed:", err);
      alert(err?.message || "ลบ Lab ไม่สำเร็จ");
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen w-full bg-[#F9FAFB] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F9FAFB]">
      <div className="pt-20 pl-0 md:pl-64 transition-all duration-300">
        <Navbar />
        <Sidebar />

        <div className="p-8 max-w-7xl mx-auto min-h-screen flex flex-col">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">My Labs</h2>
            </div>

            {/* Create Button (แสดงเฉพาะเมื่อไม่ได้โหลด หรือมีข้อมูลแล้ว) */}
            {!loading && displayLabs.length > 0 && (
              <Link
                href="/createlab"
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 font-medium"
              >
                <FaPlus size={14} /> Create New Lab
              </Link>
            )}
          </div>

          {/* Assignments List / Loading Area */}
          <div className="min-h-[300px]">
            {loading ? (
              // ============ Loading State ============
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                Loading class details...
              </div>
            ) : error ? (
              // ============ Error State ============
              <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-center">
                Error: {error}
              </div>
            ) : (
              // ============ Content State ============
              <>
                {displayLabs.length === 0 ? (
                  /* Empty State */
                  <div className="flex flex-col items-center justify-center flex-1 py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
                      <FaCube size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800">
                      No Laboratory Exercises Created
                    </h3>
                    <p className="mt-2 text-gray-500 text-sm max-w-xs text-center">
                      Get started by designing your first flowchart-based
                      challenge for your students
                    </p>
                    <Link
                      href="/createlab"
                      className="mt-6 flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition shadow-md hover:shadow-lg font-medium"
                    >
                      <FaPlus size={14} /> Create Lab Activity
                    </Link>
                  </div>
                ) : (
                  /* Grid Layout */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
                    {displayLabs.map((lab, index) => {
                      const labId = lab.labId ?? lab.id ?? index;
                      const name =
                        lab.labname ??
                        lab.labName ??
                        lab.name ??
                        "Untitled Lab";
                      const problem = lab.problemSolving ?? lab.problem ?? "";
                      const due = formatThaiDate(lab.dueDate ?? lab.dateline);
                      const testcases = lab.testcases ?? lab.testCases ?? [];
                      const totalScore = calcTotalScore(testcases);
                      const teacherName =
                        lab.author ||
                        lab.teacher ||
                        session?.user?.name ||
                        "Unknown Teacher";

                      return (
                        <Link
                          key={String(labId)}
                          href={`/labinfo/${labId}`}
                          className="block h-full"
                        >
                          <ClassCard
                            code={String(labId)}
                            title={name}
                            teacher={teacherName}
                            score={totalScore}
                            due={due}
                            problem={problem}
                            onDeleteClick={() => handleDeleteLab(labId)}
                          />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Mylab;