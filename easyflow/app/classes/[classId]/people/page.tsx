"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Tabs from "../../../Addpeople/_components/Tabs";
import AddPersonModal from "../../../Addpeople/_components/AddPersonModal";
import PeopleList from "../../../Addpeople/_components/PeopleList";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import {
  apiGetClassUsers,
  apiUpdateUserRole,
  apiRemoveUserFromClass,
  apiLeaveClass,
} from "@/app/service/FlowchartService";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTrash, FaExchangeAlt, FaCheck } from "react-icons/fa";

interface UIUser {
  name: string;
  email: string;
  position?: string;
  id: number;
}

type ModalVariant = "danger" | "action" | "success" | "info";

function Addpeople() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  const currentUserId = session?.user
    ? Number((session.user as any).id || (session.user as any).userId)
    : 0;

  const resolveClassId = (): string | null => {
    const qCandidates = ["classId", "id", "class"];
    for (const k of qCandidates) {
      const v = searchParams?.get(k);
      if (v) return v;
    }
    try {
      const parts = pathname?.split("/").filter(Boolean) ?? [];
      const numeric = parts.find((seg) => /^\d+$/.test(seg));
      if (numeric) return numeric;
    } catch {}
    return null;
  };

  const classId = resolveClassId();

  const [activeTab, setActiveTab] = useState<string>("People");
  const [teachers, setTeachers] = useState<UIUser[]>([]);
  const [tas, setTAs] = useState<UIUser[]>([]);
  const [students, setStudents] = useState<UIUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [canManage, setCanManage] = useState<boolean>(false);
  const [amIOwner, setAmIOwner] = useState<boolean>(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalRole, setModalRole] = useState<"Teacher" | "TA" | "Students">(
    "Teacher"
  );

  const fetchData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiGetClassUsers(classId);

      if (response && Array.isArray(response.users)) {
        const allData: any[] = response.users;
        const newTeachers: UIUser[] = [];
        const newTAs: UIUser[] = [];
        const newStudents: UIUser[] = [];

        const currentUid = session?.user
          ? ((
              session.user as any
            ).id || (session.user as any).userId)
          : null;
        let myRole = "";

        allData.forEach((item) => {
          const uData = item.user;
          const rData = item.role;

          if (currentUid && String(uData.id) === String(currentUid)) {
            myRole = rData?.roleName?.toLowerCase() || "";
          }

          const userForUI: UIUser = {
            id: uData.id,
            name: uData.name || `${uData.fname} ${uData.lname}` || "Unknown",
            email: uData.email || "-",
            position: rData?.roleName || "",
          };

          const roleName = rData?.roleName ? String(rData.roleName).toLowerCase() : "";

          if (roleName === "owner" || roleName === "teacher") {
            newTeachers.push(userForUI);
          } else if (roleName === "ta") {
            newTAs.push(userForUI);
          } else if (roleName === "student") {
            newStudents.push(userForUI);
          }
        });

        setTeachers(newTeachers);
        setTAs(newTAs);
        setStudents(newStudents);

        const isOwner = myRole === "owner";
        const isTeacher = myRole === "teacher";

        setAmIOwner(isOwner);
        setCanManage(isOwner || isTeacher);
      }
    } catch (err: any) {
      console.error("Error fetching class users:", err);
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [classId, session]);

  useEffect(() => {
    if (status === "loading") return;
    fetchData();
  }, [fetchData, status]);

  const openModal = (role: "Teacher" | "TA" | "Students") => {
    setModalRole(role);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  // -------------------------
  // Confirm / Info modal (replace window.confirm / alert)
  // -------------------------
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmOnConfirm, setConfirmOnConfirm] = useState<
    (() => Promise<void> | void) | null
  >(null);
  const [modalVariant, setModalVariant] = useState<ModalVariant>("action");

  /**
   * openConfirmModal(title, message, onConfirm, variant?)
   * variant: 'danger' | 'action' | 'success' | 'info'
   */
  const openConfirmModal = (
    title: string,
    message: string,
    onConfirm: (() => Promise<void> | void) | null,
    variant: ModalVariant = "action"
  ) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmOnConfirm(() => onConfirm);
    setModalVariant(variant);
    setConfirmVisible(true);
  };

  const closeConfirmModal = () => {
    setConfirmVisible(false);
    setConfirmTitle("");
    setConfirmMessage("");
    setConfirmOnConfirm(null);
    setModalVariant("action");
  };

  // keep old helper for compatibility-ish (not used for color/ icon anymore)
  const isErrorModal = (title?: string) => {
    const t = (title ?? confirmTitle ?? "").toLowerCase();
    return (
      t.includes("error") ||
      t.includes("fail") ||
      t.includes("ไม่") || // catch some Thai keywords if used
      t.includes("ผิด")
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
  // -------------------------

  // -------------------------
  // Handlers (now open confirm modal with explicit variant)
  // -------------------------
  const handleRoleChange = async (
    targetUserId: number,
    newRoleStr: "Teacher" | "TA" | "Students"
  ) => {
    if (!classId || !currentUserId) return;

    let roleId = 2; // Default Student
    if (newRoleStr === "Teacher") roleId = 1;
    else if (newRoleStr === "TA") roleId = 3;
    else if (newRoleStr === "Students") roleId = 2;

    // แปลบทบาทเป็นภาษาไทย
    const roleLabel =
      newRoleStr === "Teacher" ? "ครู" : newRoleStr === "TA" ? "ผู้ช่วยสอน" : "นักเรียน";

    const confirmMsg = `คุณแน่ใจหรือไม่ว่าต้องการเปลี่ยนบทบาทของผู้ใช้นี้เป็น “${roleLabel}”?`;

    // use 'action' variant (blue) for role-change confirmation
    openConfirmModal("ยืนยันการเปลี่ยนบทบาท", confirmMsg, async () => {
      try {
        setLoading(true);
        await apiUpdateUserRole(classId, targetUserId, roleId, currentUserId);
        // show success info modal after operation (success = green)
        openConfirmModal("เปลี่ยนบทบาทเรียบร้อย", `บทบาทถูกเปลี่ยนเป็น “${roleLabel}” เรียบร้อยแล้ว`, null, "success");
        await fetchData();
      } catch (error) {
        console.error("Change role failed", error);
        openConfirmModal("อัปเดตไม่สำเร็จ", "ไม่สามารถเปลี่ยนบทบาทได้ กรุณาลองอีกครั้ง", null, "danger");
      } finally {
        setLoading(false);
      }
    }, "action");
  };

  const handleRemoveUser = async (targetUserId: number) => {
    if (!classId || !currentUserId) return;

    // If the user attempts to remove themself -> leave class flow
    if (targetUserId === currentUserId) {
      // leaving is a destructive action -> use 'danger' variant
      openConfirmModal(
        "ออกจากคลาส",
        "คุณแน่ใจหรือไม่ว่าต้องการออกจากคลาสนี้?",
        async () => {
          try {
            setLoading(true);
            await apiLeaveClass(classId, currentUserId);
            // show success info then navigate
            openConfirmModal("ออกจากคลาสเรียบร้อยแล้ว", "คุณได้ออกจากคลาสเรียบร้อยแล้ว", null, "success");
            router.push("/myclass");
          } catch (error) {
            console.error("Leave class error:", error);
            openConfirmModal("ไม่สำเร็จ", "ไม่สามารถออกจากคลาสได้ กรุณาลองอีกครั้ง", null, "danger");
          } finally {
            setLoading(false);
          }
        },
        "danger"
      );
      return;
    }

    // Removing other user -> destructive -> 'danger'
    openConfirmModal(
      "ลบผู้ใช้",
      "คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้นี้ออกจากคลาส?",
      async () => {
        try {
          setLoading(true);
          await apiRemoveUserFromClass(classId, targetUserId, currentUserId);
          openConfirmModal("ลบผู้ใช้ออกเรียบร้อย", "ผู้ใช้ถูกลบออกจากคลาสเรียบร้อยแล้ว", null, "success");
          await fetchData();
        } catch (error) {
          console.error("Remove user error:", error);
          openConfirmModal("ไม่สำเร็จ", "ไม่สามารถลบผู้ใช้นี้ได้ กรุณาลองอีกครั้ง", null, "danger");
        } finally {
          setLoading(false);
        }
      },
      "danger"
    );
  };
  // -------------------------

  // helper flags for rendering
  const isDanger = modalVariant === "danger";
  const isAction = modalVariant === "action";
  const isSuccess = modalVariant === "success";

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
          {/* ✅ Container: Full width with max constraint for ultra-wide screens */}
          <div className="max-w-[1920px] mx-auto w-full p-4 sm:p-20 space-y-8">
            {/* Tabs Section */}
            <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Content Area */}
            {loading && teachers.length === 0 ? (
              <div className="flex justify-center items-center py-20 text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2 mr-3"></div>
                Loading people...
              </div>
            ) : error ? (
              <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-center">
                {error}
              </div>
            ) : (
              <div className="space-y-10 max-w-6xl mx-auto">
                <PeopleList
                  title="Teacher"
                  people={teachers}
                  onAdd={canManage ? () => openModal("Teacher") : undefined}
                  onRoleChange={canManage ? handleRoleChange : undefined}
                  onRemove={handleRemoveUser}
                  canManage={canManage}
                  currentUserId={currentUserId}
                />
                <PeopleList
                  title="TA"
                  people={tas}
                  onAdd={canManage ? () => openModal("TA") : undefined}
                  onRoleChange={canManage ? handleRoleChange : undefined}
                  onRemove={handleRemoveUser}
                  canManage={canManage}
                  currentUserId={currentUserId}
                />
                <PeopleList
                  title="Students"
                  people={students}
                  onAdd={canManage ? () => openModal("Students") : undefined}
                  onRoleChange={canManage ? handleRoleChange : undefined}
                  onRemove={handleRemoveUser}
                  canManage={canManage}
                  currentUserId={currentUserId}
                />
              </div>
            )}

            {/* Modal: Add person */}
            {canManage && classId && (
              <AddPersonModal
                visible={modalOpen}
                onClose={closeModal}
                role={modalRole}
                classId={classId}
                onUserAdded={fetchData}
                currentUserId={currentUserId}
              />
            )}
          </div>
        </main>
      </div>

      {/* Confirm / Info Modal (framer-motion + AnimatePresence) */}
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
            onClick={() => {
              /* intentionally do nothing on backdrop click */
            }}
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
                <div
                  className={`px-6 pt-8 pb-6 flex flex-col items-center ${
                    isDanger ? "bg-red-50" : isAction ? "bg-blue-50" : isSuccess ? "bg-green-50" : "bg-blue-50"
                  }`}
                >
                  <div
                    className={`flex items-center justify-center w-20 h-20 rounded-xl ${
                      isDanger ? "bg-red-600" : isAction ? "bg-blue-600" : isSuccess ? "bg-green-600" : "bg-blue-600"
                    } shadow-md`}
                  >
                    {isDanger ? (
                      <FaTrash size={36} className="text-white" />
                    ) : isAction ? (
                      <FaExchangeAlt size={36} className="text-white" />
                    ) : isSuccess ? (
                      <FaCheck size={36} className="text-white" />
                    ) : (
                      <FaExchangeAlt size={36} className="text-white" />
                    )}
                  </div>

                  <h3
                    id="confirm-modal-title"
                    className={`mt-4 text-2xl font-extrabold ${
                      isDanger ? "text-red-700" : isAction ? "text-blue-700" : isSuccess ? "text-green-700" : "text-blue-700"
                    }`}
                  >
                    {confirmTitle}
                  </h3>
                </div>

                {/* body */}
                <div className="px-6 pb-6 pt-4">
                  <p
                    id="confirm-modal-desc"
                    className={`text-sm text-gray-700 leading-relaxed whitespace-pre-wrap text-center font-semibold ${
                      isAction || isSuccess ? "text-center text-lg font-semibold" : ""
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
                            // close modal after confirm callback finishes
                            closeConfirmModal();
                          }
                        }}
                        className={`inline-flex items-center justify-center px-6 py-2 rounded-full text-white focus:outline-none focus:ring-2 focus:ring-offset-2 text-sm font-medium shadow-sm ${
                          isDanger
                            ? "bg-red-600 hover:bg-red-700 focus:ring-red-200"
                            : isAction
                            ? "bg-blue-600 hover:bg-blue-700 focus:ring-blue-200"
                            : isSuccess
                            ? "bg-green-600 hover:bg-green-700 focus:ring-green-200"
                            : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-200"
                        }`}
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
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M6 6L18 18M6 18L18 6"
                      stroke="#666"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
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

export default Addpeople;