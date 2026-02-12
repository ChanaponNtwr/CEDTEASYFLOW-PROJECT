"use client";
import React, { useMemo } from "react";
import { FaTrash, FaUser, FaStar } from "react-icons/fa";

type ClassCardProps = {
  code?: string | number;
  title?: string;
  problem?: string;
  teacher?: string;
  score?: string | number;
  due?: string;
  onDeleteClick?: () => void;
};

// ชุดสี Gradient สไตล์ Modern
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

// ฟังก์ชันเลือกสีจาก ID หรือ Code (เพื่อให้สีเหมือนเดิมทุกครั้งที่โหลด)
const getGradient = (id: string | number) => {
  const str = String(id);
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
  onDeleteClick,
}: ClassCardProps) {
  const headerTitle = title || (code ? `Lab ${code}` : "No Title");
  
  // คำนวณสีพื้นหลังเพียงครั้งเดียว
  const bgGradient = useMemo(() => getGradient(code || Math.random()), [code]);

  return (
    <div
      className="
        group relative
        bg-white rounded-2xl overflow-hidden
        shadow-sm hover:shadow-xl hover:-translate-y-1
        border border-gray-100
        transition-all duration-300
        cursor-pointer
        h-full flex flex-col
      "
      role="button"
      tabIndex={0}
    >
      {/* ปุ่มลบ (ซ่อนปกติ แสดงเมื่อ Hover) */}
      {onDeleteClick && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDeleteClick();
          }}
          title="Delete Lab"
          className="
            absolute top-3 right-3 z-10 
            bg-white/90 backdrop-blur-sm text-gray-400 hover:text-red-500 
            w-8 h-8 flex items-center justify-center rounded-full 
            shadow-sm opacity-0 group-hover:opacity-100 
            transition-all duration-200 transform scale-90 group-hover:scale-100
          "
        >
          <FaTrash size={12} />
        </button>
      )}

      {/* Header Section with Random Gradient */}
      <div className={`h-24 bg-gradient-to-r ${bgGradient} p-5 relative`}>
         {/* Icon Container */}
         <div className="absolute -bottom-6 left-5 w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center p-2 border border-gray-50">
            <img src="/images/lab.png" alt="lab icon" className="w-full h-full object-contain" />
         </div>
      </div>

      {/* Body Section */}
      <div className="pt-8 pb-5 px-5 flex-1 flex flex-col">
        {/* Title */}
        <h3 className="text-lg font-bold text-gray-800 truncate mb-1" title={headerTitle}>
          {headerTitle}
        </h3>
        
        {/* Problem Description (Short) */}
        <p className="text-xs text-gray-500 line-clamp-2 mb-4 h-12 leading-relaxed">
          {problem || "No description provided."}
        </p>

        {/* Footer Info */}
        <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
           <div className="flex items-center gap-1.5 overflow-hidden">
              <FaUser className="text-gray-300 flex-shrink-0" />
              <span className="truncate max-w-[100px] font-medium text-gray-600">
                {teacher || "Unknown"}
              </span>
           </div>

           {score !== undefined && (
             <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                
                <span className="font-bold text-gray-700">{score} pts</span>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

export default ClassCard;