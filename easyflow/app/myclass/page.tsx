"use client";
import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ClassCard from "./_components/ClassCard";
import ClassCard_Other from "./_components/ClassCard_Other";
import CreateClassModal from "./_components/CreateClassModal";
import Link from "next/link";
import {
  apiCreateClass,
  apiGetClasses,
  apiDeleteClass,
} from "@/app/service/FlowchartService";
import { useSession } from "next-auth/react";
import { FaPlus, FaChalkboardTeacher, FaBookReader, FaInbox } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

export type ClassItem = {
  id: number | string;
  code: string;
  title: string;
  teacher: string;
  due: string;
  problem: string;
  isOwner: boolean;
};

const getAvatarUrl = (name: string) => {
  return `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(
    name
  )}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;
};

function Myclass() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // ✅ เพิ่ม State Error

  const [myClasses, setMyClasses] = useState<ClassItem[]>([]);
  const [joinedClasses, setJoinedClasses] = useState<ClassItem[]>([]);

  const { data: session, status } = useSession();

  const currentUserId = session?.user
    ? Number((session.user as any).id || (session.user as any).userId)
    : null;

  const [formData, setFormData] = useState({
    className: "",
    section: "",
    room: "",
  });

  // ================= Confirm Modal (replace alert/confirm) =================
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmOnConfirm, setConfirmOnConfirm] = useState<(() => Promise<void> | void) | null>(null);

  const openConfirmModal = (title: string, message: string, onConfirm: (() => Promise<void> | void) | null) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmOnConfirm(() => onConfirm);
    setConfirmVisible(true);
  };

  const closeConfirmModal = () => {
    setConfirmVisible(false);
    setConfirmTitle("");
    setConfirmMessage("");
    setConfirmOnConfirm(null);
  };

  const isErrorModal = (title?: string) => {
    const t = (title ?? confirmTitle ?? "").toLowerCase();
    return (
      t.includes("ผิด") ||
      t.includes("ไม่สำเร็จ") ||
      t.includes("ล้มเหลว") ||
      t.includes("ข้อผิดพลาด") ||
      t.includes("ผิดพลาด")
    );
  };

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
  // =======================================================================

  // ================= Load Classes =================
  const loadClasses = async () => {
    if (!currentUserId) return;
    setLoading(true);
    setError(null); // ✅ Reset Error ก่อนโหลด

    try {
      const res: any = await apiGetClasses();

      if (res.ok && Array.isArray(res.classes)) {
        // เรียงลำดับจากวันที่ล่าสุดไปเก่าสุด
        const sortedClasses = res.classes.sort((a: any, b: any) => {
          return new Date(b.createAt).getTime() - new Date(a.createAt).getTime();
        });

        const ownedList: ClassItem[] = [];
        const joinedList: ClassItem[] = [];

        sortedClasses.forEach((c: any) => {
          const myUserClassEntry = c.userClasses?.find(
            (uc: any) => Number(uc.userId) === currentUserId
          );
          if (!myUserClassEntry) return;

          let teacherName = "";
          const ownerEntry = c.userClasses?.find((uc: any) => {
            const r = uc.role?.roleName?.toLowerCase() || "";
            return ["owner", "teacher", "creator"].includes(r);
          });

          if (ownerEntry && Number(ownerEntry.userId) === currentUserId) {
            teacherName = session?.user?.name || "Me";
          } else if (ownerEntry && ownerEntry.user) {
            teacherName = ownerEntry.user.name || ownerEntry.user.username || "Unknown";
          } else {
            teacherName = "Unknown Teacher";
          }

          const createdDate = c.createAt
            ? new Date(c.createAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "";

          const myRole = myUserClassEntry.role?.roleName?.toLowerCase();
          const isOwner = ["owner", "teacher", "creator"].includes(myRole);

          const classObj: ClassItem = {
            id: c.classId ?? c.id,
            code: String(c.classId ?? c.id),
            title: c.classname ?? "Untitled Class",
            teacher: teacherName,
            due: createdDate,
            problem: c.meta?.room ? `Room ${c.meta.room}` : "No Room",
            isOwner,
          };

          if (isOwner) {
            ownedList.push(classObj);
          } else {
            joinedList.push(classObj);
          }
        });

        setMyClasses(ownedList);
        setJoinedClasses(joinedList);
      } else {
        // กรณี API ตอบกลับมาแต่ไม่ ok หรือไม่มี classes
        // อาจจะไม่ได้ถือเป็น Error ร้ายแรง แต่ถ้าต้องการ Handle ก็ใส่ setError ได้
      }
    } catch (err: any) {
      console.error("Failed to fetch classes:", err);
      setError(err?.message || "Failed to load classes."); // ✅ Set Error message
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading" || !currentUserId) return;
    loadClasses();
  }, [currentUserId, status]);

  // ================= Actions =================
  // Replace confirm() with modal-based flow
  const handleDeleteClass = async (classId: string | number) => {
    if (!currentUserId) return;

    openConfirmModal(
      "ยืนยันลบ",
      "ลบคลาสนี้ถาวรหรือไม่? การกระทำไม่สามารถยกเลิกได้",
      async () => {
        try {
          await apiDeleteClass(classId, currentUserId);
          setMyClasses((prev) =>
            prev.filter((c) => String(c.id) !== String(classId))
          );
        } catch (err: any) {
          console.error("Failed to delete class:", err);
          // show error modal (reuse confirm modal to show error)
          openConfirmModal("ลบไม่สำเร็จ", err?.message || "ไม่สามารถลบคลาสได้ กรุณาลองอีกครั้ง", null);
        }
      }
    );
  };

  const openCreateModal = () => setIsModalOpen(true);
  const closeCreateModal = () => {
    setIsModalOpen(false);
    setFormData({ className: "", section: "", room: "" });
  };

  const handleCreateClass = async () => {
    const { className, section, room } = formData;
    if (!className || !section || !room) return;
    const payload = {
      classname: `${className} (${section})`,
      testcases: [],
      currentUserId,
      meta: { room },
    };
    try {
      const result = await apiCreateClass(payload);
      if (result?.ok) {
        loadClasses();
        closeCreateModal();
      }
    } catch (err) {
      alert("Failed to create class");
    }
  };

  // Loading Session (Full Screen)
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

        <div className="p-8 max-w-7xl mx-auto min-h-screen flex flex-col space-y-12">
          
          {/* ================= My Courses Section ================= */}
          <div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <FaChalkboardTeacher className="text-blue-600" />
                  My Courses
                </h2>
                <p className="text-gray-500 mt-1 text-sm ml-1">
                  Manage your active courses and student lists
                </p>
              </div>

              <button
                onClick={openCreateModal}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 font-medium"
              >
                <FaPlus size={14} /> Create New Class
              </button>
            </div>

            {/* ✅ ใช้ Logic Loading ที่คุณต้องการ */}
            <div className="min-h-[300px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                  Loading class details...
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-center">
                  Error: {error}
                </div>
              ) : (
                <>
                  {myClasses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 ">
                      <FaInbox className="w-16 h-16 mb-4 text-gray-200" />
                      <p className="text-sm text-gray-400">
                        No courses have been created
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {myClasses.map((c) => (
                        <Link
                          key={`my-${c.id}`}
                          href={`/classes/${c.id}`}
                          className="block h-full"
                        >
                          <ClassCard
                            code={c.code}
                            title={c.title}
                            teacher={c.teacher}
                            due={c.due}
                            problem={c.problem}
                            profileImage={getAvatarUrl(c.teacher)}
                            onDeleteClick={() => handleDeleteClass(c.id)}
                          />
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ================= Enrolled Courses Section ================= */}
          <div className="pt-8 border-t border-gray-200">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <FaBookReader className="text-emerald-600" />
                Enrolled Courses
              </h2>
              <p className="text-gray-500 mt-1 text-sm ml-1">
                Access the courses you are currently attending
              </p>
            </div>

            {/* ✅ ใช้ Logic Loading แบบเดียวกัน หรือแยกตามต้องการ (ที่นี่ใช้ตัวแปร loading ตัวเดียวกัน) */}
            <div className="min-h-[300px]">
              {loading ? (
                 <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                   Loading enrolled courses...
                 </div>
              ) : error ? (
                 <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-center">
                   Error: {error}
                 </div>
              ) : (
                <>
                  {joinedClasses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 ">
                      <FaInbox className="w-16 h-16 mb-4 text-gray-200" />
                      <p className="text-sm text-gray-400">
                        You are not currently enrolled in any courses
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {joinedClasses.map((c) => (
                        <Link
                          key={`join-${c.id}`}
                          href={`/classes/${c.id}`}
                          className="block h-full"
                        >
                          <ClassCard_Other
                            code={c.code}
                            title={c.title}
                            teacher={c.teacher}
                            due={c.due}
                            problem={c.problem}
                            profileImage={getAvatarUrl(c.teacher)}
                          />
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      <CreateClassModal
        isOpen={isModalOpen}
        onClose={closeCreateModal}
        onCreate={handleCreateClass}
        formData={formData}
        setFormData={setFormData}
      />

      {/* Confirm Modal (framer-motion + AnimatePresence) */}
      <AnimatePresence>
        {confirmVisible && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropVariants}
            aria-modal="true"
            role="dialog"
            onClick={() => { /* intentionally do nothing on backdrop click */ }}
          >
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              aria-hidden
            />

            <motion.div
              className="relative z-50 w-full max-w-lg mx-auto transform"
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              role="document"
              aria-labelledby="confirm-modal-title"
              aria-describedby="confirm-modal-desc"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
                {/* colored header */}
                <div className={`px-6 pt-8 pb-6 flex flex-col items-center ${isErrorModal(confirmTitle) ? "bg-red-50" : "bg-red-50"}`}>
                  <div className={`flex items-center justify-center w-20 h-20 rounded-xl ${isErrorModal(confirmTitle) ? "bg-red-600" : "bg-red-600"} shadow-md`}>
                    {isErrorModal(confirmTitle) ? (
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
                    id="confirm-modal-title"
                    className={`mt-4 text-2xl font-extrabold ${isErrorModal(confirmTitle) ? "text-red-700" : "text-red-700"}`}
                  >
                    {confirmTitle}
                  </h3>
                </div>

                {/* body */}
                <div className="px-6 pb-6 pt-4">
                  <p
                    id="confirm-modal-desc"
                    className={`text-sm text-gray-700 leading-relaxed whitespace-pre-wrap ${
                      !isErrorModal(confirmTitle) ? "text-center text-lg font-semibold" : ""
                    }`}
                  >
                    {confirmMessage}
                  </p>

                  {/* separator */}
                  <div className="w-full border-t border-gray-200 my-4" />

                  {/* buttons */}
                  <div className="mt-6 flex items-center justify-center gap-4">
                    {/* Cancel */}
                    <button
                      onClick={closeConfirmModal}
                      className="inline-flex items-center justify-center px-6 py-2 rounded-full border border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 text-sm font-medium shadow-sm"
                    >
                      ยกเลิก
                    </button>

                    {/* Confirm (only if onConfirm exists) */}
                    {confirmOnConfirm ? (
                      <button
                        onClick={async () => {
                          try {
                            if (confirmOnConfirm) await confirmOnConfirm();
                          } catch (err) {
                            console.error("confirm callback error:", err);
                          } finally {
                            // ensure modal closed after confirm (or if confirm opened an error modal it will replace)
                            closeConfirmModal();
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
                  onClick={closeConfirmModal}
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

export default Myclass;