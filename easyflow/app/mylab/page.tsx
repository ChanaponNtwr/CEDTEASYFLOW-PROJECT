"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ClassCard from "./_components/ClassCard";
import { apiGetLab, apiDeleteLab } from "@/app/service/FlowchartService";
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

    const myLabs = allLabs.filter(lab => lab.authorEmail === currentUserEmail);
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

        const updatedAllLabs = currentLocalStorageAll.map((localLab: LocalLab) => {
          const matchResult = results.find(
            r => r.ok && String(r.labId) === String(localLab.labId)
          );
          
          if (matchResult && matchResult.remoteLab) {
            anyUpdated = true;
            return {
              ...localLab,
              ...matchResult.remoteLab
            };
          }
          return localLab;
        });

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
    const userId =
      (session?.user as any)?.id ||
      (session?.user as any)?.userId;

    if (!userId) {
      alert("ไม่พบข้อมูลผู้ใช้ กรุณา Login ใหม่");
      return;
    }

    const confirmed = confirm(
      "คุณต้องการลบ Lab นี้ถาวรใช่หรือไม่?\nการกระทำนี้ไม่สามารถย้อนกลับได้"
    );
    if (!confirmed) return;

    try {
      await apiDeleteLab(String(labId), userId);

      // ✅ ลบออกจาก state ทันที
      setLabs((prev) =>
        prev.filter(
          (l) => String(l.labId ?? l.id) !== String(labId)
        )
      );

      // ✅ ลบออกจาก localStorage ด้วย
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
    return <div className="p-20 text-center">Loading session...</div>;
  }

  return (
    <div className="min-h-screen w-full ">
      <div className="pt-20 pl-72">
        <Navbar />
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col p-20">
            {/* Create Lab */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-300">
              <h2 className="text-4xl font-semibold">
                My Labs
              </h2>

              {/* ✅ แสดงปุ่มนี้เฉพาะตอน "มี Lab แล้ว" */}
              {displayLabs.length > 0 && (
                <Link
                  href="/createlab"
                  className="bg-[#0D3ACE] text-white px-4 py-2 rounded-lg hover:bg-[#0B2EA6]"
                >
                  + Create Lab
                </Link>
              )}
            </div>

            {loading && (
              <div className="mb-4 text-sm text-gray-600">
                กำลังอัปเดตข้อมูลจากเซิร์ฟเวอร์...
              </div>
            )}

            {error && (
              <div className="mb-4 text-sm text-red-600">{error}</div>
            )}

            {displayLabs.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-gray-500">
                {/* Icon (inline SVG – ไม่ใช้ไฟล์) */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-20 h-20 mb-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 17L8 21h8l-1.75-4M3 13h18M5 3h14a2 2 0 012 2v8H3V5a2 2 0 012-2z"
                  />
                </svg>

                {/* Text */}
                <p className="text-xl font-medium text-gray-600">
                  ยังไม่มี Lab สำหรับบัญชีนี้
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  คุณยังไม่ได้สร้าง Lab แรกของคุณ
                </p>

                {/* CTA */}
                <Link
                  href="/createlab"
                  className="mt-6 bg-[#0D3ACE] text-white px-6 py-3 rounded-lg hover:bg-[#0B2EA6] transition"
                >
                  + Create Lab
                </Link>
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

                  const teacherName = 
                    lab.author || 
                    lab.teacher || 
                    session?.user?.name || 
                    "Unknown Teacher";

                  return (
                    <Link
                      key={String(labId)}
                      href={`/labinfo/${labId}`} 
                      className="block"
                    >
                      <ClassCard
                        code={String(labId)}
                        title={name}
                        teacher={teacherName} 
                        score={totalScore}
                        due={due}
                        problem={problem || "—"}
                        // ✅ ส่ง handler ลบเข้าไป
                        onDeleteClick={() => handleDeleteLab(labId)}
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
