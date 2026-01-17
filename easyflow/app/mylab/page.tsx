"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
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
  // เพิ่ม field author เผื่อ API ส่งกลับมา
  author?: string; 
  teacher?: string;
};

/* =======================
   Helpers
======================= */

// วันที่แบบประเทศไทย
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

// รวมคะแนนจาก testcases
function calcTotalScore(testcases?: any[]) {
  if (!Array.isArray(testcases)) return 0;
  return testcases.reduce((sum, tc) => {
    const s = Number(tc?.score);
    return sum + (isNaN(s) ? 0 : s);
  }, 0);
}

function Mylab() {
  // 2. ดึงข้อมูล Session
  const { data: session } = useSession();

  const [labs, setLabs] = useState<LocalLab[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* =======================
      Load labs
  ======================= */
  useEffect(() => {
    const stored = localStorage.getItem("labs");
    const parsed: LocalLab[] = stored ? JSON.parse(stored) : [];
    setLabs(parsed);

    const remoteLabs = parsed.filter(
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

        const updated = [...parsed];
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
          localStorage.setItem("labs", JSON.stringify(updated));
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
  }, []);

  /* =======================
      Sort newest first
  ======================= */
  const displayLabs = [...labs].sort((a, b) => {
    const da = new Date(a.createdAt ?? a.id ?? 0).getTime();
    const db = new Date(b.createdAt ?? b.id ?? 0).getTime();
    return db - da;
  });

  return (
    <div className="min-h-screen w-full ">
      <div className="pt-20 pl-72">
        <Navbar />
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col p-20">
            {/* Create Lab */}
            <div className="flex justify-end">
              <Link
                href="/createlab"
                className="bg-[#0D3ACE] text-white px-4 py-2 rounded-lg hover:bg-[#0B2EA6]"
              >
                + Create Lab
              </Link>
            </div>

            <h2 className="text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-4">
              My Labs
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
                  const labId = lab.labId ?? lab.id ?? index;
                  const name =
                    lab.labname ?? lab.labName ?? lab.name ?? "Untitled Lab";
                  const problem =
                    lab.problemSolving ?? lab.problem ?? "";
                  const due = formatThaiDate(
                    lab.dueDate ?? lab.dateline
                  );

                  const testcases = lab.testcases ?? lab.testCases ?? [];
                  const totalScore = calcTotalScore(testcases);

                  // 3. กำหนดชื่อผู้สร้าง
                  // ลำดับความสำคัญ:
                  // 1. ชื่อจาก API (ถ้ามี field author/teacher)
                  // 2. ชื่อจาก Session (คน Login ปัจจุบัน)
                  // 3. Fallback "Unknown"
                  const teacherName = 
                    lab.author || 
                    lab.teacher || 
                    session?.user?.name || 
                    "Unknown Teacher";

                  return (
                    <Link
                      key={String(labId)}
                      href={`/labinfo?labId=${labId}`}
                      className="block"
                    >
                      <ClassCard
                        code={String(labId)}
                        title={name}
                        // ส่งชื่อ teacher ไปที่ Card
                        teacher={teacherName} 
                        score={totalScore}
                        due={due}
                        problem={problem || "—"}
                      />
                    </Link>
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

export default Mylab;