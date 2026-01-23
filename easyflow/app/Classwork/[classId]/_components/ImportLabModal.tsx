"use client";

import React, { useRef, useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
// ✅ 1. ต้อง Import apiUpdateLabDueDate เข้ามาด้วย
import { apiAddLabToClass, apiUpdateLabDueDate } from "@/app/service/FlowchartService";

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
  // ✅ Props สำหรับโหมดแก้ไข
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

  // --- Effect: จัดการข้อมูลเมื่อเปิด Modal ---
  useEffect(() => {
    if (isOpen) {
      setError(null);

      if (isEditMode && editData?.dueDate) {
        // 🟡 กรณีแก้ไข: ดึงค่าเดิมมาใส่ Form
        try {
          const d = new Date(editData.dueDate);
          if (!isNaN(d.getTime())) {
            // แปลงเวลาตาม Local Time ของเครื่อง
            const pad = (n: number) => (n < 10 ? "0" + n : n);
            const yyyy = d.getFullYear();
            const mm = pad(d.getMonth() + 1);
            const dd = pad(d.getDate());
            const hh = pad(d.getHours());
            const min = pad(d.getMinutes());

            // อัปเดต State ให้ Form แสดงค่าเดิม
            setFormData({
              labId: editData.labId || "",
              dueDate: `${yyyy}-${mm}-${dd}`,
              dueTime: `${hh}:${min}`,
            });
          }
        } catch (e) {
          console.error("Error parsing date:", e);
        }
      } else if (!isEditMode) {
        // 🟢 กรณี Import: โหลดข้อมูลจาก SessionStorage
        try {
          const raw = sessionStorage.getItem("selectedImportedLabs");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.labs) && parsed.labs.length > 0) {
              const names = parsed.labs.map((l: any) => l.name ?? l.labId ?? l.id);
              setSelectedLabel(names.length <= 2 ? names.join(", ") : `${names.length} selected`);
            } else if (Array.isArray(parsed?.labIds) && parsed.labIds.length > 0) {
              setSelectedLabel(`${parsed.labIds.length} selected`);
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

  // Logic เปิด DatePicker
  const openDatePicker = () => {
    try {
      if (dateInputRef.current && typeof (dateInputRef.current as any).showPicker === "function") {
        (dateInputRef.current as any).showPicker();
      } else {
        dateInputRef.current?.focus();
      }
    } catch {
      dateInputRef.current?.focus();
    }
  };

  // Logic เปิด TimePicker
  const openTimePicker = () => {
    try {
      if (timeInputRef.current && typeof (timeInputRef.current as any).showPicker === "function") {
        (timeInputRef.current as any).showPicker();
      } else {
        timeInputRef.current?.focus();
      }
    } catch {
      timeInputRef.current?.focus();
    }
  };

  const handleOpenSelectlab = () => {
    try {
      sessionStorage.setItem("importForm", JSON.stringify(formData));
      sessionStorage.setItem("importMode", "1");
      sessionStorage.setItem("importReturn", window.location.pathname || "/");
    } catch {
      // ignore
    }
    router.push("/Selectlab");
  };

  // ✅ ฟังก์ชัน Submit เดียวที่จัดการทั้ง 2 กรณี
  const handleSubmitAction = async () => {
    setError(null);

    // 1. ตรวจสอบข้อมูลพื้นฐาน
    if (!userId) {
      alert("ไม่พบข้อมูลผู้ใช้ (User ID missing). กรุณาล็อกอินใหม่อีกครั้ง");
      return;
    }
    if (!classId) {
      setError("Missing classId.");
      return;
    }

    // 2. ตรวจสอบวันที่และเวลา
    if (!formData.dueDate || !formData.dueTime) {
      setError("กรุณาระบุ Due Date และ Time ให้ครบถ้วน");
      return;
    }

    // 3. รวมวันที่และเวลาเป็น ISO String
    let dueDateTimeIso = "";
    try {
      const combined = new Date(`${formData.dueDate}T${formData.dueTime}:00`);
      if (isNaN(combined.getTime())) {
        setError("รูปแบบวันเวลาไม่ถูกต้อง");
        return;
      }
      dueDateTimeIso = combined.toISOString();
    } catch (e) {
      setError("เกิดข้อผิดพลาดในการแปลงวันเวลา");
      return;
    }

    setLoading(true);

    try {
      if (isEditMode) {
        // -----------------------
        // 🟡 โหมดแก้ไข (EDIT) -> ใช้ PATCH
        // -----------------------
        // ใช้ labId จาก editData เพื่อความชัวร์ หรือจาก formData ก็ได้
        const targetLabId = editData?.labId || formData.labId;
        
        if (!targetLabId) {
            throw new Error("Missing Lab ID for update");
        }

        await apiUpdateLabDueDate(classId, targetLabId, userId, dueDateTimeIso);
        
        // สำเร็จ
        onAddClick?.(); // แจ้ง Parent ให้รีเฟรช
        onClose();

      } else {
        // -----------------------
        // 🟢 โหมดนำเข้า (IMPORT) -> ใช้ POST
        // -----------------------
        let payloadRaw = sessionStorage.getItem("selectedImportedLabs");
        if (!payloadRaw) {
          alert("ยังไม่ได้เลือก My lab โปรดกด + My lab เพื่อเลือก");
          setLoading(false);
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(payloadRaw);
        } catch {
          alert("ข้อมูลที่เลือกไม่ถูกต้อง");
          setLoading(false);
          return;
        }

        let labIds: string[] = [];
        if (Array.isArray(parsed?.labIds)) {
          labIds = parsed.labIds;
        } else if (Array.isArray(parsed?.labs)) {
          labIds = parsed.labs.map((l: any) => l.labId ?? l.id ?? l);
        }

        if (!labIds || labIds.length === 0) {
          alert("ยังไม่ได้เลือก My lab โปรดเลือกอย่างน้อย 1 รายการ");
          setLoading(false);
          return;
        }

        // วนลูปยิง API เพิ่ม Lab ทีละตัว
        const promises = labIds.map((lid) => 
          // @ts-ignore
          apiAddLabToClass(classId, lid, userId, dueDateTimeIso)
        );
        
        const results = await Promise.allSettled(promises);
        const failures = results.filter((r) => r.status === "rejected");

        if (failures.length > 0) {
          console.error("Import partial failures:", failures);
          setError(`${failures.length} รายการนำเข้าไม่สำเร็จ`);
        } else {
          // เคลียร์ Session เมื่อสำเร็จ
          try {
            sessionStorage.removeItem("selectedImportedLabs");
            sessionStorage.removeItem("importForm");
            sessionStorage.removeItem("importMode");
            sessionStorage.removeItem("importReturn");
          } catch {}

          onAddClick?.(); 
          onClose();
        }
      }

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
            {/* Header Handle */}
            <div className="flex justify-center mb-2">
              <div onClick={onClose} className="w-28 h-1 bg-[#dbdbdb] rounded-lg cursor-pointer hover:bg-gray-400 transition-colors" />
            </div>
            
            {/* Title & Icon */}
            <div className="mb-6 flex items-center">
              <div className="w-16 h-16 bg-[#E9E5FF] rounded-full flex items-center justify-center mr-2">
                <Image src="/images/import.png" alt="Icon" width={30} height={30} />
              </div>
              <div className="flex flex-col justify-center ml-4">
                <h2 className="text-3xl font-medium text-gray-800">
                    {isEditMode ? "Edit Due Date" : "Import Mylab"}
                </h2>
                {isEditMode && editData?.labName && (
                    <span className="text-sm text-gray-500 mt-1 truncate max-w-[200px]">
                        {editData.labName}
                    </span>
                )}
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* ปุ่มเลือก Lab (แสดงเฉพาะตอน Import) */}
              {!isEditMode && (
                  <div>
                    <label className="block text-gray-500 mb-1">My lab</label>
                    <button
                      type="button"
                      onClick={handleOpenSelectlab}
                      className="w-full h-12 border border-gray-300 bg-[#E9E5FF] rounded-lg flex items-center justify-center hover:bg-[#D3CCFE] transition-all duration-200"
                    >
                      {selectedLabel ? (
                        <span className="text-sm text-gray-700 font-medium">{selectedLabel}</span>
                      ) : (
                        <FaPlus className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </div>
              )}

              {/* Assignment due date & time */}
              <div className="space-y-4">
                {/* Date Input */}
                <div>
                  <label className="block text-gray-500 font-medium mb-2">
                      {isEditMode ? "New Due Date" : "Assignment Due Date"}
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      name="dueDate"
                      ref={dateInputRef}
                      value={formData.dueDate}
                      onChange={handleInputChange}
                      onClick={openDatePicker}
                      className="w-full h-12 px-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 appearance-none cursor-pointer"
                      min={todayStr}
                    />
                  </div>
                </div>

                {/* Time Input */}
                <div>
                  <label className="block text-gray-500 font-medium mb-2">Time</label>
                  <div className="relative">
                    <input
                      type="time"
                      name="dueTime"
                      ref={timeInputRef}
                      value={formData.dueTime}
                      onChange={handleInputChange}
                      onClick={openTimePicker}
                      className="w-full h-12 px-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Error & Loading Status */}
            {error && <div className="mt-4 text-sm text-red-600 bg-red-50 p-2 rounded text-center">{error}</div>}
            {loading && <div className="mt-4 text-sm text-gray-600 text-center animate-pulse">Processing...</div>}

            {/* Buttons */}
            <div className="flex justify-center gap-3 mt-8">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 rounded-full text-gray-700 hover:bg-gray-300 transition-all duration-200 cursor-pointer font-medium"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAction}
                className={`px-6 py-2 rounded-full text-white transition-all duration-200 cursor-pointer font-medium ${
                  loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                }`}
                disabled={loading}
              >
                {loading 
                    ? "Processing..." 
                    : isEditMode ? "Save Changes" : "Import"
                }
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ImportLabModal;