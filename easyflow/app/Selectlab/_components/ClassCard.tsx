"use client";
import React, { useMemo } from "react";
import { FaCheck, FaCube, FaUser, FaClock, FaStar } from "react-icons/fa";

interface ClassCardProps {
  // Data Props
  code?: string | number;
  title?: string;
  problem?: string;
  teacher?: string;
  score?: string | number;
  due?: string;

  // Functional Props
  isChecked?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
  onCardClick?: () => void;
}

// ชุดสี Gradient (ชุดเดียวกับ MyClass/MyLab เพื่อความคุมโทน)
const gradients = [
  "from-blue-500 to-indigo-600",
  "from-emerald-400 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-orange-400 to-pink-600",
  "from-cyan-400 to-blue-500",
  "from-rose-400 to-red-500",
  "from-amber-400 to-orange-500",
  "from-fuchsia-500 to-pink-600",
];

const getGradient = (id: string | number) => {
  const str = String(id || "default");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

function ClassCard({
  code,
  title = "",
  problem = "",
  teacher = "",
  score,
  due = "",
  isChecked = false,
  onCheckboxChange,
  onCardClick,
}: ClassCardProps) {
  
  // สุ่มสีพื้นหลังตาม Code หรือ Title
  const bgGradient = useMemo(() => getGradient(code || title), [code, title]);

  // Handle Checkbox Click
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // ป้องกันไม่ให้ trigger card click
    if (onCheckboxChange) {
      onCheckboxChange(!isChecked);
    }
  };

  return (
    <div
      onClick={onCardClick}
      className={`
        group relative
        bg-white rounded-2xl overflow-hidden
        shadow-sm hover:shadow-xl hover:-translate-y-1
        border-2 
        ${isChecked ? "border-blue-500 ring-2 ring-blue-200" : "border-transparent hover:border-gray-100"}
        transition-all duration-300
        cursor-pointer
        h-full flex flex-col
      `}
    >
      {/* Header Section with Random Gradient */}
      <div className={`h-24 bg-gradient-to-r ${bgGradient} p-5 relative`}>
        
        {/* Checkbox (Custom UI) */}
        <div 
            onClick={handleCheckboxClick}
            className={`
                absolute top-3 right-3 z-20 
                w-8 h-8 rounded-full flex items-center justify-center
                cursor-pointer transition-all duration-200 shadow-sm
                ${isChecked 
                    ? "bg-white text-blue-600 scale-110" 
                    : "bg-black/20 text-transparent hover:bg-white/40 border-2 border-white/50"}
            `}
        >
            <FaCheck size={14} className={isChecked ? "opacity-100" : "opacity-0"} />
        </div>

        {/* Floating Icon Container */}
        <div className="absolute -bottom-6 left-5 w-12 h-12 bg-white rounded-2xl shadow-md flex items-center justify-center p-1 border border-gray-50">
           <div className="w-full h-full bg-gray-50 rounded-xl flex items-center justify-center text-blue-500">
             <img src="/images/lab.png" alt="lab icon" className="w-full h-full object-contain" />
           </div>
        </div>
      </div>

      {/* Body Section */}
      <div className="pt-9 pb-5 px-5 flex-1 flex flex-col">
        {/* Title */}
        <div className="mb-2">
            <h3 className="text-lg font-bold text-gray-800 truncate" title={title}>
              {title || "Untitled Lab"}
            </h3>
            <p className="text-xs font-semibold text-gray-400 mt-1 line-clamp-1">
                {problem || "No description"}
            </p>
        </div>

        {/* Footer Info */}
        <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
           <div className="flex items-center gap-2 overflow-hidden">
              <FaUser className="text-gray-300 flex-shrink-0" />
              <span className="truncate max-w-[100px] font-medium text-gray-600">
                {teacher || "Unknown"}
              </span>
           </div>

            {/* แสดงคะแนนหรือวันที่ */}
           <div className="flex items-center gap-1.5">
              {score !== undefined ? (
                  <>
                    
                    <span>{score} pts</span>
                  </>
              ) : (
                  <>
                    <FaClock className="text-gray-300" />
                    <span>{due}</span>
                  </>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}

export default ClassCard;