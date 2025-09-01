"use client";

import React, { useRef } from "react";
import { FaPlus } from "react-icons/fa";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface ImportLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddClick?: () => void;
  formData: { labId: string; dueDate: string; dueTime: string };
  setFormData: React.Dispatch<React.SetStateAction<{ labId: string; dueDate: string; dueTime: string }>>;
}

function ImportLabModal({ isOpen, onClose, onAddClick, formData, setFormData }: ImportLabModalProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (formData.dueDate && formData.dueTime) {
      console.log("Submitted:", { ...formData });
      onClose();
    } else {
      alert("กรุณากรอกข้อมูลวันที่และเวลให้ครบถ้วน");
    }
  };

  const handleDateIconClick = () => {
    dateInputRef.current?.focus();
    dateInputRef.current?.showPicker();
  };

  const handleTimeIconClick = () => {
    timeInputRef.current?.focus();
    timeInputRef.current?.showPicker();
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
                <Link
                  href="/Selectlab"
                  onClick={onAddClick}
                  className="w-full h-12 border border-gray-300 bg-[#E9E5FF] rounded-lg flex items-center justify-center hover:bg-[#D3CCFE] transition-all duration-200 cursor-pointer"
                >
                  <FaPlus className="w-3 h-3 text-gray-500" />
                </Link>
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
                      className="w-full h-12 px-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 appearance-none"
                      min={new Date().toISOString().split("T")[0]}
                    />
                    <Image
                      src="/images/date.png"
                      alt="Date Icon"
                      width={24}
                      height={24}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer"
                      onClick={handleDateIconClick}
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
                      className="w-full h-12 px-4 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 appearance-none"
                      min="08:00"
                      max="18:00"
                      step={900}
                    />
                    <Image
                      src="/images/clock.png"
                      alt="Clock Icon"
                      width={24}
                      height={24}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer"
                      onClick={handleTimeIconClick}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 rounded-full text-gray-700 hover:bg-gray-300 transition-all duration-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all duration-200 cursor-pointer"
              >
                Create
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ImportLabModal;
