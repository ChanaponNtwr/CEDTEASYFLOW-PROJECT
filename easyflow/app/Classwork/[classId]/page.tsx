"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Tabs from "./_components/Tabs";
import ClassHeader from "./_components/ClassHeader";
import FilterActions from "./_components/FilterActions";
import AssignmentItem from "./_components/AssignmentItem";
import ImportLabModal from "./_components/ImportLabModal";
import { apiGetClass, apiRemoveLabFromClass } from "@/app/service/FlowchartService";
import { useSession } from "next-auth/react";
import { FaInbox } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

// ZONE ตั้งค่ารูปภาพ: ใส่ Path รูปภาพที่คุณมีใน public/images/ ตรงนี้
// ระบบจะสุ่มเลือกจากรายการนี้ตาม Class ID
const CLASS_COVERS = [
  "/images/cover-code.jpg",     // รูปที่ 2 (ตัวอย่าง)
  "/images/cover-code1.jpg", // รูปที่ 3 (ตัวอย่าง)
  "/images/cover-code2.jpg",
  "/images/cover-code3.jpg",
  "/images/cover-code4.jpg",      // รูปที่ 4 (ตัวอย่าง)
  // เพิ่มรูปได้เรื่อยๆ...
];

// ถ้าอยากใช้รูปจากเน็ตแบบสุ่มอัตโนมัติ (ไม่ต้องหารูปเอง) ให้แก้บรรทัด useMemo ด้านล่างตามคอมเมนต์

type FilterType = "all" | "oldest" | "newest" | "todo";

function Classwork({ classId: propClassId }: { classId?: string }) {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const routeClassId = params ? (params.classId as string) : undefined;
  const finalClassId = propClassId ?? routeClassId;

  const { data: session, status } = useSession();

  // ... (User logic remains same)
  const currentUserId = useMemo(() => {
    if (!session?.user) return undefined;
    const user = session.user as any;
    return user.id || user.userId || user.sub;
  }, [session]);

  const [activeTab, setActiveTab] = useState<string>("Classwork");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingLab, setEditingLab] = useState<{
    labId: string;
    dueDate: string;
    labName: string;
  } | null>(null);
  const [formData, setFormData] = useState({ labId: "", dueDate: "", dueTime: "" });
  const [classDetail, setClassDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [filter, setFilter] = useState<FilterType>("newest");

  // NEW LOGIC: เลือกรูปภาพตาม Class ID
  const coverImage = useMemo(() => {
    // กรณีไม่มี Class ID ให้ใช้รูปแรก
    if (!finalClassId) return CLASS_COVERS[0];

    // 1. วิธีใช้รูปในเครื่อง (แนะนำ):
    // แปลง Class ID เป็นตัวเลขผลรวม (Hash)
    let hash = 0;
    for (let i = 0; i < finalClassId.length; i++) {
      hash = finalClassId.charCodeAt(i) + ((hash << 5) - hash);
    }
    // เลือก Index โดยการหารเอาเศษ
    const index = Math.abs(hash) % CLASS_COVERS.length;
    return CLASS_COVERS[index];

    // 2. วิธีใช้รูปจากเน็ต (Picsum) *ต้องตั้งค่า next.config.js ให้รองรับ domain picsum.photos*
    // return `https://picsum.photos/seed/${finalClassId}/1200/400`;
  }, [finalClassId]);

  useEffect(() => {
    const shouldOpen = searchParams?.get("openImport");
    if (shouldOpen === "true") {
      setIsModalOpen(true);
      const newUrl = window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    }
  }, [searchParams]);

  const handleCreateClick = () => {
    setEditingLab(null);
    setFormData({ labId: "", dueDate: "", dueTime: "" });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLab(null);
  };

  const fetchClass = async (cid: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetClass(cid);
      setClassDetail(data);
      if (currentUserId && data.userClasses) {
        const myEntry = data.userClasses.find((uc: any) => {
          const idInRelation = uc.userId ? String(uc.userId) : null;
          const idInUserObj = uc.user?.id ? String(uc.user.id) : null;
          const currentStr = String(currentUserId);
          return idInRelation === currentStr || idInUserObj === currentStr;
        });
        if (myEntry?.role?.roleName) {
          setCurrentUserRole(myEntry.role.roleName.toLowerCase());
        }
      }
    } catch (err: any) {
      console.error("apiGetClass failed:", err);
      setError(err?.message || "Failed to load class");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading") return;
    if (finalClassId) {
      fetchClass(finalClassId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalClassId, status, session]);

  const handleAddClick = async () => {
    if (!finalClassId) return;
    await fetchClass(finalClassId);
  };

  const handleEditLab = (labId: string, rawDueDate: string, title: string) => {
    setEditingLab({ labId, dueDate: rawDueDate, labName: title });
    setIsModalOpen(true);
  };

  // ------------------------------
  // Modal-based confirm (replace alert/confirm)
  // ------------------------------
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmOnConfirm, setConfirmOnConfirm] = useState<(() => Promise<void> | void) | null>(null);

  const openConfirmModal = (
    title: string,
    message: string,
    onConfirm: (() => Promise<void> | void) | null
  ) => {
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

  // Replace confirm+alert flow with modal
  const handleDeleteLab = async (labId: string) => {
    if (!finalClassId) return;

    if (!currentUserId) {
      // replace alert -> modal
      openConfirmModal("ไม่พบผู้ใช้", "ไม่สามารถตรวจสอบผู้ใช้ปัจจุบันได้ กรุณาเข้าสู่ระบบใหม่", null);
      return;
    }

    openConfirmModal(
      "ยืนยันการลบ",
      "ลบ Lab นี้จาก Class ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้",
      async () => {
        try {
          setLoading(true);
          setError(null);
          await apiRemoveLabFromClass(finalClassId, labId, currentUserId);
          await fetchClass(finalClassId);
        } catch (err: any) {
          console.error("Failed to remove lab from class:", err);
          // replace alert -> modal (show error)
          openConfirmModal("ลบ Lab ไม่สำเร็จ", err?.message || "ลบ Lab ไม่สำเร็จ", null);
        } finally {
          setLoading(false);
        }
      }
    );
  };
  // ------------------------------

  const assignments = useMemo(() => {
    if (!classDetail?.classLabs?.length) return [];
    let list = classDetail.classLabs.map((cl: any) => {
      const lab = cl.lab || {};
      const actualDueDate = cl.dueDate || lab.dueDate;
      return {
        labId: lab.labId,
        title: lab.labname || "Untitled Lab",
        problemSolving: lab.problemSolving || "",
        rawDueDate: actualDueDate || "",
        dueDate: actualDueDate
          ? new Date(actualDueDate).toLocaleDateString("th-TH", {
            year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          })
          : "No due date",
      };
    });

    if (filter === "newest") {
      list.sort((a: any, b: any) => new Date(b.rawDueDate || 0).getTime() - new Date(a.rawDueDate || 0).getTime());
    } else if (filter === "oldest") {
      list.sort((a: any, b: any) => new Date(a.rawDueDate || 0).getTime() - new Date(b.rawDueDate || 0).getTime());
    } else if (filter === "todo") {
      const now = new Date().getTime();
      list = list.filter((a: any) => {
        if (!a.rawDueDate) return true;
        return new Date(a.rawDueDate).getTime() >= now;
      });
    }
    return list;
  }, [classDetail, filter]);

  const hasClassLoaded = classDetail !== null;
  const canEdit = ["owner", "teacher"].includes(currentUserRole);

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="flex pt-16">
        {/* Sidebar Fixed */}
        <div className="hidden lg:block w-64 fixed h-[calc(100vh-4rem)] top-16 left-0 overflow-y-auto bg-white border-r border-gray-200 z-10">
          <Sidebar />
        </div>

        {/* Main Content */}
        <main className="flex-1 lg:pl-64 w-full">
          <div className="max-w-[1920px] mx-auto w-full p-4 sm:p-20 space-y-6">

            <Tabs
              classId={finalClassId || ""}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            {/* ส่งรูปที่เลือกแบบสุ่ม(แต่คงที่) ไปยัง ClassHeader */}
            <ClassHeader
              code={classDetail?.classname ?? "—"}
              teacher={
                classDetail?.userClasses?.find(
                  (u: any) => u.role?.roleName === "owner"
                )?.user?.name ?? "—"
              }
              schedule={
                classDetail?.createAt
                  ? `Created ${new Date(classDetail.createAt).toLocaleDateString()}`
                  : "—"
              }
              backgroundImage={coverImage}
            />

            <FilterActions
              onCreateClick={canEdit ? handleCreateClick : undefined}
              onFilterChange={setFilter}
            />

            {/* Assignments List */}
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
              ) : assignments.length === 0 && hasClassLoaded ? (
                <div className="flex flex-col items-center justify-center py-20 ">
                  <FaInbox className="w-16 h-16 mb-4 text-gray-200" />
                  <h2 className="text-xl font-semibold text-gray-600 mb-1">
                    No Labs Yet
                  </h2>
                  <p className="text-sm text-gray-400">
                    Labs will appear here once added.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col space-y-3 pb-20">
                  {assignments.map((a: any, idx: number) => {
                    // <-- เปลี่ยนตรงนี้: ถ้า role เป็น "ta" ให้ลิงก์ไปที่ labviewscore ด้วย
                    const linkHref =
                      // ถ้าเป็น owner หรือ teacher (canEdit) ให้ไป labviewscore — (เดิม)
                      // ถ้าเป็น ta เราก็ให้ไป labviewscore เช่นกัน
                      (canEdit || currentUserRole === "ta")
                        ? `/labviewscore/${a.labId}`
                        : `/Studentlab/${a.labId}`;

                    return (
                      <Link key={idx} href={linkHref} className="block group">
                        <AssignmentItem
                          title={a.title}
                          description={a.problemSolving}
                          due={a.dueDate}
                          onEditClick={
                            canEdit ? () => handleEditLab(a.labId, a.rawDueDate, a.title) : undefined
                          }
                          onDeleteClick={
                            canEdit ? () => handleDeleteLab(a.labId) : undefined
                          }
                        />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {canEdit && (
        <ImportLabModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onAddClick={handleAddClick}
          formData={formData}
          setFormData={setFormData}
          classId={finalClassId}
          userId={currentUserId}
          isEditMode={!!editingLab}
          editData={editingLab || undefined}
        />
      )}

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
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              aria-hidden
            />

            {/* Modal Card */}
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
                {/* header */}
                <div className={`px-6 pt-8 pb-6 flex flex-col items-center ${isErrorModal(confirmTitle) ? "bg-red-50" : "bg-red-50"}`}>
                  <div className={`flex items-center justify-center w-20 h-20 rounded-xl ${isErrorModal(confirmTitle) ? "bg-red-600" : "bg-red-600"} shadow-md`}>
                    {isErrorModal(confirmTitle) ? (
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M6 6L18 18M6 18L18 6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path d="M3 6h18" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M10 11v6M14 11v6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
                    className={`text-sm text-gray-700 leading-relaxed whitespace-pre-wrap ${!isErrorModal(confirmTitle) ? "text-center text-lg font-semibold" : ""
                      }`}
                  >
                    {confirmMessage}
                  </p>

                  {/* separator */}
                  <div className="w-full border-t border-gray-200 my-4" />

                  {/* buttons */}
                  <div className="mt-6 flex items-center justify-center gap-4">
                    <button
                      onClick={closeConfirmModal}
                      className="inline-flex items-center justify-center px-6 py-2 rounded-full border border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 text-sm font-medium shadow-sm"
                    >
                      ยกเลิก
                    </button>

                    {confirmOnConfirm ? (
                      <button
                        onClick={async () => {
                          try {
                            if (confirmOnConfirm) await confirmOnConfirm();
                          } catch (err) {
                            console.error("confirm callback error:", err);
                          } finally {
                            // close after confirm (if the confirm callback wants to show another modal it can)
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
                    <path d="M6 6L18 18M6 18L18 6" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

export default Classwork;