"use client";

import React, { useRef, useEffect, useState } from "react";
import { FaPlus, FaCalendarAlt, FaClock } from "react-icons/fa";
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

      // Pre-fill Logic (Edit Mode)
      if (isEditMode && editData?.dueDate) {
        try {
          const dt = new Date(editData.dueDate);
          if (!isNaN(dt.getTime())) {
            const yyyy = dt.getFullYear();
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const dd = String(dt.getDate()).padStart(2, '0');
            const hh = String(dt.getHours()).padStart(2, '0');
            const min = String(dt.getMinutes()).padStart(2, '0');

            setFormData({
              labId: editData.labId,
              dueDate: `${yyyy}-${mm}-${dd}`,
              dueTime: `${hh}:${min}`,
            });
          }
        } catch (e) {
          console.error("Error parsing edit date", e);
        }
        setSelectedLabel(null);
      } 
      // Import Mode Logic
      else if (!isEditMode) {
        try {
          const raw = sessionStorage.getItem("selectedImportedLabs");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.labs) && parsed.labs.length > 0) {
              const names = parsed.labs.map((l: any) => l.name ?? l.labId ?? l.id);
              setSelectedLabel(
                names.length <= 2 ? names.join(", ") : `${names.length} Labs Selected`
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

  const handleSubmitAction = async () => {
    setError(null);
    if (!userId) { alert("User not found"); return; }
    if (!classId) { setError("Missing classId."); return; }
    if (!formData.dueDate || !formData.dueTime) { setError("Please specify Due Date and Time"); return; }

    const combined = new Date(`${formData.dueDate}T${formData.dueTime}:00`);
    if (isNaN(combined.getTime())) { setError("Invalid Date/Time format"); return; }
    const dueDateTimeIso = combined.toISOString();

    setLoading(true);

    try {
      if (isEditMode) {
        if (!editData?.labId) throw new Error("Missing Lab ID for edit");
        
        await apiUpdateLabDueDate(classId, editData.labId, userId, dueDateTimeIso);
        
        try {
          const labResp = await apiGetLab(editData.labId);
          const currentLab = labResp?.lab ?? labResp;
          if (currentLab) {
            const updatePayload = { ...currentLab, dueDate: dueDateTimeIso, dateline: dueDateTimeIso };
            if (typeof apiUpdateLab === 'function') await apiUpdateLab(editData.labId, updatePayload);
          }
        } catch (innerErr) { console.error("Failed to update lab entity date:", innerErr); }

        onAddClick?.(); 
        onClose();
        return; 
      }

      // Import Mode
      let payloadRaw = sessionStorage.getItem("selectedImportedLabs");
      if (!payloadRaw) { alert("No labs selected"); setLoading(false); return; }

      let parsed = JSON.parse(payloadRaw);
      let labIds: string[] = [];
      if (Array.isArray(parsed?.labIds)) labIds = parsed.labIds;
      else if (Array.isArray(parsed?.labs)) labIds = parsed.labs.map((l: any) => l.labId ?? l.id ?? l);

      if (!labIds.length) { alert("No labs selected"); setLoading(false); return; }

      for (const sourceLabId of labIds) {
        const sourceResp = await apiGetLab(String(sourceLabId));
        const sourceLab = sourceResp?.lab ?? sourceResp;
        if (!sourceLab) throw new Error(`Source lab not found: ${sourceLabId}`);

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
        const newLabId = createResp?.lab?.labId || createResp?.labId || createResp?.id;

        if (!newLabId) throw new Error("Failed to create new lab copy");
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
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-2xl p-8 w-full max-w-lg shadow-2xl overflow-hidden relative"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center mb-8">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mr-4 shrink-0">
                <Image src="/images/import.png" alt="Icon" width={32} height={32} className="object-contain" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {isEditMode ? "Edit Assignment" : "Import Lab"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {isEditMode ? `Editing "${editData?.labName || 'Unknown'}"` : "Select a lab from your collection"}
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-6">
              {!isEditMode && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select Lab Source</label>
                  <button
                    type="button"
                    onClick={handleOpenSelectlab}
                    className={`w-full h-14 border-2 border-dashed rounded-xl flex items-center justify-center transition-all duration-200 group
                      ${selectedLabel ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"}
                    `}
                  >
                    {selectedLabel ? (
                      <span className="text-blue-700 font-semibold flex items-center">
                        <FaPlus className="mr-2 w-3 h-3" /> {selectedLabel}
                      </span>
                    ) : (
                      <div className="flex items-center text-gray-400 group-hover:text-blue-500">
                        <FaPlus className="mr-2" />
                        <span>Choose from My Labs</span>
                      </div>
                    )}
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      name="dueDate"
                      ref={dateInputRef}
                      value={formData.dueDate}
                      onChange={handleInputChange}
                      className="w-full h-12 pl-10 pr-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-600"
                      min={todayStr}
                    />
                    <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Time</label>
                  <div className="relative">
                    <input
                      type="time"
                      name="dueTime"
                      ref={timeInputRef}
                      value={formData.dueTime}
                      onChange={handleInputChange}
                      className="w-full h-12 pl-10 pr-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-600"
                    />
                    <FaClock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-6 text-sm text-red-600 bg-red-50 p-3 rounded-lg text-center border border-red-100">
                {error}
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-medium transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAction}
                className="px-8 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl font-medium shadow-lg shadow-blue-200 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? "Processing..." : (isEditMode ? "Save Changes" : "Import Lab")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ImportLabModal;