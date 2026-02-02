"use client";

import React, { useRef, useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

import { 
  apiAddLabToClass, 
  apiUpdateLabDueDate,
  apiGetLab,
  apiCreateLab,
  apiUpdateLab
} from "@/app/service/FlowchartService";

interface ImportForm {
  labId: string;
  dueDate: string;
  dueTime: string;
}

interface ImportLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddClick?: () => void;
  formData: ImportForm;
  setFormData: React.Dispatch<React.SetStateAction<ImportForm>>;
  classId?: string;
  userId?: string;
  isEditMode?: boolean;
  editData?: { labId: string; dueDate: string; labName?: string };
}

function ImportLabModal({
  isOpen,
  onClose,
  onAddClick,
  formData,
  setFormData,
  classId,
  userId,
  isEditMode = false,
  editData,
}: ImportLabModalProps) {
  const router = useRouter();

  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const timeInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);

      // ✅ กรณี Edit Mode: ดึงค่าเดิมมาใส่ Form (Pre-fill)
      if (isEditMode && editData?.dueDate) {
        try {
          const dt = new Date(editData.dueDate);
          if (!isNaN(dt.getTime())) {
            // แปลงเป็น Local Time เพื่อแยก Date/Time
            const yyyy = dt.getFullYear();
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const dd = String(dt.getDate()).padStart(2, '0');
            const hh = String(dt.getHours()).padStart(2, '0');
            const min = String(dt.getMinutes()).padStart(2, '0');

            setFormData({
              labId: editData.labId,
              dueDate: `${yyyy}-${mm}-${dd}`, // Format สำหรับ input type="date"
              dueTime: `${hh}:${min}`,       // Format สำหรับ input type="time"
            });
          }
        } catch (e) {
          console.error("Error parsing edit date", e);
        }
        setSelectedLabel(null);
      } 
      // ✅ กรณี Import Mode: โหลดข้อมูลจาก Session (Logic เดิม)
      else if (!isEditMode) {
        try {
          const raw = sessionStorage.getItem("selectedImportedLabs");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.labs) && parsed.labs.length > 0) {
              const names = parsed.labs.map((l: any) => l.name ?? l.labId ?? l.id);
              setSelectedLabel(
                names.length <= 2 ? names.join(", ") : `${names.length} selected`
              );
            } else {
              setSelectedLabel(null);
            }
          } else {
            setSelectedLabel(null);
          }
        } catch {
          setSelectedLabel(null);
        }
      }
    }
  }, [isOpen, isEditMode, editData, setFormData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value } as ImportForm));
  };

  const handleOpenSelectlab = () => {
    try {
      sessionStorage.setItem("importForm", JSON.stringify(formData));
      sessionStorage.setItem("importMode", "1");
      sessionStorage.setItem("importReturn", window.location.pathname || "/");
    } catch {}
    router.push("/Selectlab");
  };

  // ===============================
  // 🔥 CORE: SUBMIT (IMPORT OR UPDATE)
  // ===============================
  const handleSubmitAction = async () => {
    setError(null);

    if (!userId) {
      alert("ไม่พบข้อมูลผู้ใช้");
      return;
    }
    if (!classId) {
      setError("Missing classId.");
      return;
    }

    if (!formData.dueDate || !formData.dueTime) {
      setError("กรุณาระบุ Due Date และ Time");
      return;
    }

    const combined = new Date(`${formData.dueDate}T${formData.dueTime}:00`);
    if (isNaN(combined.getTime())) {
      setError("รูปแบบวันเวลาไม่ถูกต้อง");
      return;
    }
    const dueDateTimeIso = combined.toISOString();

    setLoading(true);

    try {
      // ✅ 1. กรณีโหมดแก้ไข (Edit Mode)
      if (isEditMode) {
        if (!editData?.labId) {
            throw new Error("ไม่พบ Lab ID สำหรับแก้ไข");
        }
        
        // 1.1 อัปเดต Due Date ของ Lab ใน Class
        await apiUpdateLabDueDate(classId, editData.labId, userId, dueDateTimeIso);
        
        // 1.2 อัปเดตข้อมูลที่ตัว Lab ด้วย
        try {
          const labResp = await apiGetLab(editData.labId);
          const currentLab = labResp?.lab ?? labResp;

          if (currentLab) {
            const updatePayload = {
              ...currentLab,
              dueDate: dueDateTimeIso,
              dateline: dueDateTimeIso, 
            };
            
            if (typeof apiUpdateLab === 'function') {
                await apiUpdateLab(editData.labId, updatePayload);
            }
          }
        } catch (innerErr) {
          console.error("Failed to update lab entity date:", innerErr);
        }

        onAddClick?.(); 
        onClose();
        return; 
      }

      // ✅ 2. กรณีโหมด Import (Copy Lab)
      let payloadRaw = sessionStorage.getItem("selectedImportedLabs");
      if (!payloadRaw) {
        alert("ยังไม่ได้เลือก My lab");
        setLoading(false);
        return;
      }

      let parsed = JSON.parse(payloadRaw);

      let labIds: string[] = [];
      if (Array.isArray(parsed?.labIds)) {
        labIds = parsed.labIds;
      } else if (Array.isArray(parsed?.labs)) {
        labIds = parsed.labs.map((l: any) => l.labId ?? l.id ?? l);
      }

      if (!labIds.length) {
        alert("ยังไม่ได้เลือก My lab");
        setLoading(false);
        return;
      }

      // วน Loop สร้าง Lab ใหม่
      for (const sourceLabId of labIds) {
        const sourceResp = await apiGetLab(String(sourceLabId));
        const sourceLab = sourceResp?.lab ?? sourceResp;

        if (!sourceLab) {
          throw new Error(`ไม่พบข้อมูล Lab ต้นฉบับ: ${sourceLabId}`);
        }

        const createPayload = {
          ownerUserId: userId,
          labname: sourceLab.labname || sourceLab.name,
          problemSolving: sourceLab.problemSolving || "",
          inSymVal: sourceLab.inSymVal,
          outSymVal: sourceLab.outSymVal,
          declareSymVal: sourceLab.declareSymVal,
          assignSymVal: sourceLab.assignSymVal,
          ifSymVal: sourceLab.ifSymVal,
          forSymVal: sourceLab.forSymVal,
          whileSymVal: sourceLab.whileSymVal,
          status: "active",
          testcases: sourceLab.testcases || [],
          dueDate: dueDateTimeIso,
          dateline: dueDateTimeIso,
        };

        const createResp = await apiCreateLab(createPayload);

        const newLabId =
          createResp?.lab?.labId ||
          createResp?.labId ||
          createResp?.id;

        if (!newLabId) {
          throw new Error("สร้าง Lab ใหม่ไม่สำเร็จ (ไม่ได้รับ labId)");
        }

        await apiAddLabToClass(classId, newLabId, userId, dueDateTimeIso);
      }

      try {
        sessionStorage.removeItem("selectedImportedLabs");
        sessionStorage.removeItem("importForm");
        sessionStorage.removeItem("importMode");
        sessionStorage.removeItem("importReturn");
      } catch {}

      onAddClick?.();
      onClose();

    } catch (err: any) {
      console.error("Operation failed:", err);
      setError(err?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-gray-900/20 backdrop-blur-md flex items-center justify-center z-[1000]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-6 flex items-center">
              <div className="w-16 h-16 bg-[#E9E5FF] rounded-full flex items-center justify-center mr-2">
                <Image src="/images/import.png" alt="Icon" width={30} height={30} />
              </div>
              <div className="ml-4">
                <h2 className="text-3xl font-medium text-gray-800">
                  {isEditMode ? (editData?.labName || "Edit Lab") : "Import Mylab"}
                </h2>
              </div>
            </div>

            {!isEditMode && (
              <div className="mb-4">
                <label className="block text-gray-500 mb-1">My lab</label>
                <button
                  type="button"
                  onClick={handleOpenSelectlab}
                  className="w-full h-12 border border-gray-300 bg-[#E9E5FF] rounded-lg flex items-center justify-center"
                >
                  {selectedLabel ? (
                    <span className="text-sm text-gray-700 font-medium">
                      {selectedLabel}
                    </span>
                  ) : (
                    <FaPlus className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-gray-500 mb-2">
                  Assignment Due Date
                </label>
                <input
                  type="date"
                  name="dueDate"
                  ref={dateInputRef}
                  value={formData.dueDate}
                  onChange={handleInputChange}
                  className="w-full h-12 px-4 border rounded-lg"
                  min={todayStr}
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-2">Time</label>
                <input
                  type="time"
                  name="dueTime"
                  ref={timeInputRef}
                  value={formData.dueTime}
                  onChange={handleInputChange}
                  className="w-full h-12 px-4 border rounded-lg"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 text-sm text-red-600 bg-red-50 p-2 rounded text-center">
                {error}
              </div>
            )}

            <div className="flex justify-center gap-3 mt-8">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 rounded-full"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAction}
                className="px-6 py-2 rounded-full text-white bg-blue-600"
                disabled={loading}
              >
                {loading ? "Processing..." : (isEditMode ? "Update" : "Import")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ImportLabModal;