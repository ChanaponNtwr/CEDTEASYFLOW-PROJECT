"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ClassCard from './_components/ClassCard';
import { apiGetLab } from "@/app/service/FlowchartService"; // <-- import API

// ขยาย type ให้ครอบคลุมชื่อ fields ต่าง ๆ ที่อาจมาจาก backend หรือ localStorage
type LocalLab = {
  id?: number;                 // local generated id (Date.now)
  labId?: number | string;     // remote labId (if created on server)
  name?: string;
  labname?: string;
  labName?: string;
  dateline?: string;           // local dateline (YYYY-MM-DD)
  dueDate?: string;            // ISO string from server
  problem?: string;
  problemSolving?: string;
  testCases?: any[];           // local format
  testcases?: any[];           // server format (possible)
  symbols?: any;
  createdAt?: string;
  remoteCreated?: boolean;
  testcaseUploadStatus?: string;
};

function formatDueDate(d?: string) {
  if (!d) return "No due";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString();
  } catch {
    return d;
  }
}

function Mylab() {
  const [labs, setLabs] = useState<LocalLab[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // โหลด labs จาก localStorage
  useEffect(() => {
    const stored = localStorage.getItem("labs");
    const parsed: LocalLab[] = stored ? JSON.parse(stored) : [];
    setLabs(parsed);

    // สำหรับแต่ละ lab ที่มี labId ให้เรียก apiGetLab เพื่อตรวจสอบ/อัพเดตข้อมูล (เช่น testcases)
    const remoteLabs = parsed.filter((l) => l.labId !== undefined && l.labId !== null);
    if (remoteLabs.length === 0) return;

    let mounted = true;
    const fetchRemote = async () => {
      setLoading(true);
      setError(null);
      try {
        const promises = remoteLabs.map(async (l) => {
          try {
            const resp = await apiGetLab(String(l.labId));
            // backend อาจคืน object { ok: true, lab: {...} } หรือ direct lab object
            const remoteLab = resp?.lab ?? resp;
            return { ok: true, labId: l.labId, remoteLab };
          } catch (err) {
            console.error("[Mylab] apiGetLab error for labId", l.labId, err);
            return { ok: false, labId: l.labId, error: err };
          }
        });

        const results = await Promise.all(promises);

        if (!mounted) return;

        // ผสานข้อมูลที่ได้กลับเข้ากับ state และ localStorage
        const updated = [...parsed];
        let anyUpdated = false;
        results.forEach((r) => {
          if (r.ok && r.remoteLab) {
            const idx = updated.findIndex((x) => String(x.labId) === String(r.labId));
            if (idx !== -1) {
              // ผสาน fields สำคัญ: name, dueDate/problemSolving/testcases
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
          } catch (e) {
            console.warn("[Mylab] localStorage set error:", e);
          }
        }
      } catch (err: any) {
        console.error("[Mylab] fetchRemote error:", err);
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

  // ถ้าไม่มี lab ใน localStorage ให้แสดง placeholder
  const displayLabs = labs.length ? labs : [];

  return (
    <div className="min-h-screen w-full bg-gray-100">
      <div className="pt-20 pl-72">
        <Navbar />
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col p-20">
            <div className="flex justify-end">
              <Link href="/createlab"
                className="bg-[#0D3ACE] text-white px-4 py-2 rounded-lg flex items-center hover:bg-[#0B2EA6] hover:shadow-lg transition-all duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Create Lab
              </Link>
            </div>

            <h2 className="text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-4">My Labs</h2>

            {loading && (
              <div className="mb-4 text-sm text-gray-600">Updating labs from server...</div>
            )}

            {error && (
              <div className="mb-4 text-sm text-red-600">Error: {error}</div>
            )}

            {displayLabs.length === 0 ? (
              <div className="p-6 text-gray-600">No labs found. Click "Create Lab" to add one.</div>
            ) : (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayLabs.map((lab, index) => {
                  const labId = lab.labId ?? lab.id ?? `local-${index}`;
                  // รองรับชื่อหลายรูปแบบ
                  const name = lab.labname ?? lab.labName ?? lab.name ?? `Lab ${index+1}`;
                  // รองรับคำอธิบาย/ปัญหา
                  const problem = lab.problemSolving ?? lab.problem ?? "";
                  // รองรับ due หลายรูปแบบ
                  const due = lab.dueDate ?? lab.dateline ?? lab.dateline;
                  const dueText = formatDueDate(due);
                  // รองรับ testcases / testCases
                  const tcCount = (lab.testcases ?? lab.testCases ?? []).length;

                  return (
                    <Link
                      href={labId ? `/labinfo?labId=${labId}` : "/labinfo"}
                      key={labId + "-" + index}
                      className="block"
                    >
                      <ClassCard
                        code={String(labId)}
                        title={name}
                        teacher={"You"}
                        due={`${dueText} • ${tcCount} TC`}
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
