"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ClassCard from "./_components/ClassCard";
import { apiGetLab, apiDeleteLab } from "@/app/service/FlowchartService";
import { useSession } from "next-auth/react";
import { FaPlus, FaCube } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

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

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  // onConfirm will run when user clicks the confirm button in modal
  const [modalOnConfirm, setModalOnConfirm] = useState<(() => void) | null>(null);

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
       Delete Lab (My Lab) - now uses modal instead of alert/confirm
   ======================= */
  const openModal = (title: string, message: string, onConfirm: (() => void) | null) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalOnConfirm(() => onConfirm);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setModalTitle("");
    setModalMessage("");
    setModalOnConfirm(null);
  };

  const isErrorModal = () => {
    if (!modalTitle) return false;
    const t = modalTitle.toLowerCase();
    return (
      t.includes("ผิด") ||
      t.includes("ไม่สำเร็จ") ||
      t.includes("ล้มเหลว") ||
      t.includes("ข้อผิดพลาด") ||
      t.includes("ผิดพลาด")
    );
  };

  const handleDeleteLab = (labId: string | number) => {
    const userId = (session?.user as any)?.id || (session?.user as any)?.userId;
    if (!userId) {
      // แทน alert -> modal (ข้อความกระชับ)
      openModal("ไม่พบผู้ใช้", "กรุณาเข้าสู่ระบบใหม่", null);
      return;
    }

    // แทน confirm -> modal (ข้อความกระชับ)
    openModal(
      "ยืนยันลบ",
      "ลบ Lab นี้ถาวรหรือไม่? การกระทำไม่สามารถยกเลิกได้",
      async () => {
        // onConfirm callback (จะรันเมื่อกดปุ่มยืนยันใน modal)
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
          // แทน alert -> modal แสดงข้อผิดพลาด (ข้อความกระชับ)
          openModal("ลบไม่สำเร็จ", err?.message || "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง", null);
        } finally {
          // ปิด modal ยืนยัน (the current modal) — แต่ถ้าเกิด error เราจะเปิด modal ใหม่ใน catch
          closeModal();
        }
      }
    );
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen w-full bg-[#F9FAFB] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading session...</div>
      </div>
    );
  }

  // framer-motion modal variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 20 },
  };

  const successModal = !isErrorModal();

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

      {/* Modal (framer-motion + AnimatePresence) */}
      <AnimatePresence>
        {modalVisible && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropVariants}
            aria-modal="true"
            role="dialog"
            // ตั้งใจไม่ปิดเมื่อคลิก backdrop เพื่อเลียนแบบ alert behavior
            onClick={() => { /* intentionally do nothing on backdrop click */ }}
          >
            {/* Backdrop overlay */}
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              aria-hidden
            />

            {/* Modal card */}
            <motion.div
              className="relative z-50 w-full max-w-lg mx-auto transform"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              role="document"
              aria-labelledby="modal-title"
              aria-describedby="modal-desc"
              onClick={(e) => e.stopPropagation()} // prevent backdrop click
            >
              <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
                {/* colored header */}
                <div className={`px-6 pt-8 pb-6 flex flex-col items-center ${isErrorModal() ? "bg-red-50" : "bg-red-50"}`}>
                  <div className={`flex items-center justify-center w-20 h-20 rounded-xl ${isErrorModal() ? "bg-red-600" : "bg-red-600"} shadow-md`}>
                    {isErrorModal() ? (
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M6 6L18 18M6 18L18 6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      // trash icon for delete-confirm modal
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M3 6h18" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M10 11v6M14 11v6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>

                  <h3
                    id="modal-title"
                    className={`mt-4 text-2xl font-extrabold ${isErrorModal() ? "text-red-700" : "text-red-700"}`}
                  >
                    {modalTitle}
                  </h3>
                </div>

                {/* body */}
                <div className="px-6 pb-6 pt-4">
                  <p
                    id="modal-desc"
                    className={`text-sm text-gray-700 leading-relaxed whitespace-pre-wrap ${
                      successModal ? "text-center text-lg font-semibold" : ""
                    }`}
                  >
                    {modalMessage}
                  </p>

                  {/* separator */}
                  <div className="w-full border-t border-gray-200 my-4" />

                  {/* buttons */}
                  <div className="mt-6 flex items-center justify-center gap-4">
                    {/* Cancel */}
                    <button
                      onClick={closeModal}
                      className="inline-flex items-center justify-center px-6 py-2 rounded-full border border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 text-sm font-medium shadow-sm"
                    >
                      ยกเลิก
                    </button>

                    {/* Confirm (only if onConfirm exists) */}
                    {modalOnConfirm ? (
                      <button
                        onClick={async () => {
                          try {
                            // call confirm callback
                            await modalOnConfirm();
                          } catch (err) {
                            console.error("modal confirm callback error:", err);
                          } finally {
                            // ensure modal closed after confirm
                            closeModal();
                          }
                        }}
                        className="inline-flex items-center justify-center px-6 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-200 text-sm font-medium shadow-sm"
                      >
                        ยืนยัน
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* small close button */}
                <button
                  onClick={closeModal}
                  aria-label="close"
                  className="absolute top-4 right-4 bg-white border border-gray-200 rounded-full w-9 h-9 flex items-center justify-center shadow"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M6 6L18 18M6 18L18 6" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Mylab;