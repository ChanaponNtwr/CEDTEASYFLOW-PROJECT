"use client";

import React, { useRef, useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
// อย่าลืมอัปเดต apiAddLabToClass ใน FlowchartService ให้รับ parameter ตัวที่ 4 ด้วยนะครับ
import { apiAddLabToClass } from "@/app/service/FlowchartService";

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
}

function ImportLabModal({
  isOpen,
  onClose,
  onAddClick,
  formData,
  setFormData,
  classId,
  userId,
}: ImportLabModalProps) {
  const router = useRouter();

  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const timeInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load selected labs from sessionStorage
  useEffect(() => {
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
  }, [isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value } as ImportForm));
  };

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

  const handleImport = async () => {
    setError(null);

    // 1. Validate User & Class
    if (!userId) {
      alert("ไม่พบข้อมูลผู้ใช้ (User ID missing). กรุณาล็อกอินใหม่อีกครั้ง");
      return;
    }
    if (!classId) {
      setError("Missing classId (cannot import to unknown class).");
      return;
    }

    // 2. Get Selected Labs
    let payloadRaw = sessionStorage.getItem("selectedImportedLabs");
    if (!payloadRaw) {
      alert("ยังไม่ได้เลือก My lab โปรดกด + My lab เพื่อเลือก");
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(payloadRaw);
    } catch {
      alert("ข้อมูลที่เลือกไม่ถูกต้อง");
      return;
    }

    let labIds: string[] = [];
    if (Array.isArray(parsed?.labIds)) {
      labIds = parsed.labIds;
    } else if (Array.isArray(parsed?.labs)) {
      labIds = parsed.labs.map((l: any) => l.labId ?? l.id ?? l);
    } else {
      alert("ยังไม่ได้เลือก My lab โปรดเลือกอย่างน้อย 1 รายการ");
      return;
    }

    if (!labIds || labIds.length === 0) {
      alert("ยังไม่ได้เลือก My lab โปรดเลือกอย่างน้อย 1 รายการ");
      return;
    }

    // 3. Validate Date & Time
    if (!formData.dueDate || !formData.dueTime) {
      setError("กรุณาระบุ Due Date และ Time ให้ครบถ้วน");
      return;
    }

    // 4. Construct ISO Date String
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
      // 5. Call API with dueDate
      // หมายเหตุ: ต้องแก้ apiAddLabToClass ใน FlowchartService ให้รับ argument ตัวที่ 4 (dueDate) ด้วย
      // หรือเปลี่ยนเป็นรับ Object payload
      const promises = labIds.map((lid) => 
        // @ts-ignore: ถ้า TypeScript ฟ้องว่า argument เกิน ให้ใส่ @ts-ignore หรือไปแก้ interface apiAddLabToClass
        apiAddLabToClass(classId, lid, userId, dueDateTimeIso)
      );
      
      const results = await Promise.allSettled(promises);
      const failures = results.filter((r) => r.status === "rejected");

      if (failures.length > 0) {
        console.error("Import partial failures:", failures);
        setError(`${failures.length} รายการนำเข้าไม่สำเร็จ`);
      } else {
        // Success cleanup
        try {
          sessionStorage.removeItem("selectedImportedLabs");
          sessionStorage.removeItem("importForm");
          sessionStorage.removeItem("importMode");
          sessionStorage.removeItem("importReturn");
        } catch {}

        onAddClick?.(); // Refresh parent
        onClose();      // Close modal
        // alert("Import สำเร็จ"); // Optional alert
      }
    } catch (err: any) {
      console.error("Import failed:", err);
      setError(err?.message || "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    handleImport();
  };

  // Helper เพื่อหา min date (วันนี้)
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
            
            {/* Title */}
            <div className="mb-6 flex items-center">
              <div className="w-16 h-16 bg-[#E9E5FF] rounded-full flex items-center justify-center mr-2">
                <Image src="/images/import.png" alt="Import Icon" width={30} height={30} />
              </div>
              <div className="flex justify-center ml-6">
                <h2 className="text-4xl font-medium">Import Mylab</h2>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* My lab Button */}
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

              {/* Assignment due date & time */}
              <div className="space-y-4">
                {/* Date Input */}
                <div>
                  <label className="block text-gray-500 font-medium mb-2">Assignment Due Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      name="dueDate"
                      ref={dateInputRef}
                      value={formData.dueDate}
                      onChange={handleInputChange}
                      onClick={openDatePicker}
                      // onFocus={openDatePicker} // บางครั้ง onFocus อาจทำให้เด้งเปิดรัวๆ ถ้าไม่ระวัง
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
                      // onFocus={openTimePicker}
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
                onClick={handleSubmit}
                className={`px-6 py-2 rounded-full text-white transition-all duration-200 cursor-pointer font-medium ${
                  loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                }`}
                disabled={loading}
              >
                {loading ? "Importing..." : "Import"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ImportLabModal;