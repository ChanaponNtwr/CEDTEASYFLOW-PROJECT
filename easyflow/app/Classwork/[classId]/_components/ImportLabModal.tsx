"use client";

import React, { useRef, useEffect, useState } from "react";
import { FaPlus } from "react-icons/fa";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
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
  userId?: string; // ตรวจสอบว่า Parent ส่งค่านี้มาถูกต้อง
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
    const el = dateInputRef.current;
    if (!el) return;
    try {
      const anyEl = el as any;
      if (typeof anyEl.showPicker === "function") {
        anyEl.showPicker();
      } else {
        el.focus();
      }
    } catch {
      el.focus();
    }
  };

  const openTimePicker = () => {
    const el = timeInputRef.current;
    if (!el) return;
    try {
      const anyEl = el as any;
      if (typeof anyEl.showPicker === "function") {
        anyEl.showPicker();
      } else {
        el.focus();
      }
    } catch {
      el.focus();
    }
  };

  const handleOpenSelectlab = () => {
    try {
      sessionStorage.setItem("importForm", JSON.stringify(formData));
      sessionStorage.setItem("importMode", "1");
      sessionStorage.setItem("importReturn", window.location.pathname || "/");
    } catch {
      // ignore storage errors
    }
    router.push("/Selectlab");
  };

  const handleImport = async () => {
    setError(null);

    // 1. เพิ่มการเช็ค userId เพื่อความชัวร์
    if (!userId) {
      alert("ไม่พบข้อมูลผู้ใช้ (User ID missing). กรุณาล็อกอินใหม่อีกครั้ง");
      return;
    }

    if (!classId) {
      setError("Missing classId (cannot import to unknown class).");
      return;
    }

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

    setLoading(true);
    try {
      // เรียก Service: ส่ง userId ไปเป็น argument ตัวที่ 3
      const promises = labIds.map((lid) => apiAddLabToClass(classId, lid, userId));
      
      const results = await Promise.allSettled(promises);
      const failures = results.filter((r) => r.status === "rejected");

      if (failures.length > 0) {
        console.error("Import partial failures:", failures);
        // build readable message
        const msgs = failures
          .map((f: any, idx: number) => {
            const reason = f.reason;
            const text =
              typeof reason === "string"
                ? reason
                : reason?.message ?? JSON.stringify(reason?.response?.data ?? reason);
            return `#${idx + 1}: ${text}`;
          })
          .join("\n");
        setError(`${failures.length} รายการนำเข้าไม่สำเร็จ`);
        alert(`${failures.length} รายการนำเข้าไม่สำเร็จ:\n${msgs}`);
      } else {
        try {
          sessionStorage.removeItem("selectedImportedLabs");
          sessionStorage.removeItem("importForm");
          sessionStorage.removeItem("importMode");
          sessionStorage.removeItem("importReturn");
        } catch {}

        // แจ้ง parent ให้รีเฟรช (handleAddClick จะเรียก fetchClass)
        onAddClick?.();
        onClose();
        alert("Import สำเร็จ");
      }
    } catch (err: any) {
      console.error("Import failed:", err);
      const serverMsg =
        err?.response?.data?.message ||
        err?.response?.data ||
        (err?.response ? `HTTP ${err.response.status}` : null);
      const userMsg = serverMsg ?? err?.message ?? "Import failed";
      setError(String(userMsg));
      alert(`Import failed: ${userMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    // ถ้าต้องการบังคับ due date/time ให้ตรวจที่นี่ก่อนเรียก handleImport
    handleImport();
  };

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
            {/* Header */}
            <div className="flex justify-center mb-2">
              <div onClick={onClose} className="w-28 h-1 bg-[#dbdbdb] rounded-lg cursor-pointer" />
            </div>
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
                    <span className="text-sm text-gray-700">{selectedLabel}</span>
                  ) : (
                    <FaPlus className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              </div>

              {/* Assignment due date */}
              <div className="space-y-4">
                {/* Date */}
                <div>
                  <label className="block text-gray-500 font-medium mb-2">Assignment Due Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={handleInputChange}
                      ref={dateInputRef}
                      onClick={openDatePicker}
                      onFocus={openDatePicker}
                      className="w-full h-12 px-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 appearance-none"
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                </div>

                {/* Time */}
                <div>
                  <label className="block text-gray-500 font-medium mb-2">Time</label>
                  <div className="relative">
                    <input
                      type="time"
                      name="dueTime"
                      value={formData.dueTime}
                      onChange={handleInputChange}
                      ref={timeInputRef}
                      onClick={openTimePicker}
                      onFocus={openTimePicker}
                      className="w-full h-12 px-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 appearance-none"
                      min="08:00"
                      max="18:00"
                      step={900}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
            {loading && <div className="mt-3 text-sm text-gray-600">Importing…</div>}

            {/* Buttons */}
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 rounded-full text-gray-700 hover:bg-gray-300 transition-all duration-200 cursor-pointer"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all duration-200 cursor-pointer"
                disabled={loading}
              >
                {loading ? "Importing…" : "Import"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ImportLabModal;