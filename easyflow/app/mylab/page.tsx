"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
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
  // [Added] เพิ่ม field นี้เพื่อใช้เช็คเจ้าของ
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
  const { data: session, status } = useSession(); // เพิ่ม status เพื่อเช็ค loading session
  const [labs, setLabs] = useState<LocalLab[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ดึง Email ของคนปัจจุบัน
  const currentUserEmail = session?.user?.email;

  /* =======================
      Load labs
  ======================= */
  useEffect(() => {
    // ถ้า Session ยังโหลดไม่เสร็จ หรือไม่มี User ให้ไม่ทำอะไร (หรือเคลียร์ Lab)
    if (status === "loading") return;
    if (!currentUserEmail) {
        setLabs([]); // ถ้าไม่ได้ login ให้ไม่แสดงอะไรเลย
        return;
    }

    const stored = localStorage.getItem("labs");
    const allLabs: LocalLab[] = stored ? JSON.parse(stored) : [];

    // [KEY CHANGE] กรองเฉพาะ Lab ที่ authorEmail ตรงกับคน Login
    // หมายเหตุ: คุณต้องแน่ใจว่าตอน Create Lab คุณได้บันทึก authorEmail ลงไปใน localStorage ด้วย
    const myLabs = allLabs.filter(lab => lab.authorEmail === currentUserEmail);

    setLabs(myLabs);

    // ดึงข้อมูลอัปเดตจาก Server (เฉพาะของ User นี้)
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

        // Note: เราจะไม่อัปเดตกลับไปทับ LocalStorage ทั้งก้อนแบบเดิมตรงๆ 
        // เพราะอาจจะไปลบของ User อื่นทิ้ง (ถ้าใช้ browser เดียวกัน)
        // แต่วิธีที่ง่ายที่สุดคือ อัปเดต state ปัจจุบัน และ อัปเดต localStorage เฉพาะส่วนของ User นี้
        
        // 1. ดึงข้อมูลทั้งหมดจาก LocalStorage อีกรอบเพื่อความชัวร์
        const currentLocalStorageAll = stored ? JSON.parse(stored) : [];
        let anyUpdated = false;

        // 2. Map เพื่อ update ข้อมูลใหม่
        const updatedAllLabs = currentLocalStorageAll.map((localLab: LocalLab) => {
            // เช็คว่าเป็น Lab ของเรา และ ID ตรงกับที่ fetch มาไหม
            const matchResult = results.find(r => r.ok && String(r.labId) === String(localLab.labId));
            
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
          // Update State ที่แสดงผล (กรองเฉพาะของเรา)
          const updatedMyLabs = updatedAllLabs.filter((l: LocalLab) => l.authorEmail === currentUserEmail);
          setLabs(updatedMyLabs);

          // Save กลับลง LocalStorage (เก็บของทุกคนไว้เหมือนเดิม อัปเดตแค่ค่าที่เปลี่ยน)
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
  // เพิ่ม dependency: currentUserEmail เพื่อให้ useEffect รันใหม่เมื่อเปลี่ยน User
  }, [currentUserEmail, status]); 

  /* =======================
      Sort newest first
  ======================= */
  const displayLabs = [...labs].sort((a, b) => {
    const da = new Date(a.createdAt ?? a.id ?? 0).getTime();
    const db = new Date(b.createdAt ?? b.id ?? 0).getTime();
    return db - da;
  });

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
            <div className="flex justify-end">
              <Link
                href="/createlab"
                className="bg-[#0D3ACE] text-white px-4 py-2 rounded-lg hover:bg-[#0B2EA6]"
              >
                + Create Lab
              </Link>
            </div>

            <h2 className="text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-4">
              My Labs <span className="text-base text-gray-500 font-normal">(User: {session?.user?.name})</span>
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
                ยังไม่มี Lab สำหรับบัญชีนี้ หรือคุณยังไม่ได้สร้าง Lab
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

                  // ใช้ชื่อจาก Lab object ก่อน ถ้าไม่มีให้ fallback
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