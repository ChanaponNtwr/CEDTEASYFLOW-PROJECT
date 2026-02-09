"use client";
import React, { useMemo } from "react";
import { FaTrash, FaUser, FaClock } from "react-icons/fa";

interface ClassCardProps {
  code?: string;        // ใช้เป็น Class Name หรือ ID สำหรับสุ่มสี
  title?: string;       // ชื่อวิชา
  teacher?: string;     // ชื่อผู้สอน
  due?: string;         // วันที่สร้าง/Due date
  problem?: string;     // รายละเอียด/Section
  profileImage?: string; // รูปโปรไฟล์ผู้สอน
  onDeleteClick?: () => void;
}

// ชุดสี Gradient สไตล์ Modern (เหมือนหน้า Lab)
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

// ฟังก์ชันสุ่มสีจาก Code หรือ Title เพื่อให้สีเหมือนเดิมเสมอเมื่อรีเฟรช
const getGradient = (id: string) => {
  const str = String(id || "default");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

function ClassCard({
  code = "",
  title = "",
  teacher = "",
  due = "",
  problem = "",
  profileImage,
  onDeleteClick,
}: ClassCardProps) {
  
  // คำนวณสีพื้นหลังเพียงครั้งเดียวจาก code (หรือ id)
  const bgGradient = useMemo(() => getGradient(code), [code]);

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
    >
      {/* ปุ่มลบ (แสดงเมื่อ Hover) */}
      {onDeleteClick && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDeleteClick();
          }}
          title="Delete Class"
          className="
            absolute top-3 right-3 z-20 
            bg-white/90 backdrop-blur-sm text-gray-400 hover:text-red-500 hover:bg-red-50
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
         {/* Floating Icon Container (รูปโปรไฟล์) */}
         <div className="absolute -bottom-6 left-5 w-14 h-14 bg-white rounded-2xl shadow-md flex items-center justify-center p-1 border border-gray-50">
            <img 
              src={profileImage || "https://api.dicebear.com/9.x/personas/svg?seed=default"} 
              alt="Avatar" 
              className="w-full h-full object-cover rounded-xl" 
            />
         </div>
      </div>

      {/* Body Section */}
      <div className="pt-9 pb-5 px-5 flex-1 flex flex-col">
        {/* Title & Section */}
        <div className="mb-2">
            <h3 className="text-lg font-bold text-gray-800 truncate" title={title || code}>
            {title || code || "Untitled Class"}
            </h3>
            {/* แสดง Problem หรือ Section เป็นตัวหนังสือเล็กๆ ด้านล่างชื่อวิชา */}
            {/* <p className="text-xs font-semibold text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded-md mt-1">
                {problem || "General"}
            </p> */}
        </div>

        {/* Footer Info */}
        <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
           <div className="flex items-center gap-2 overflow-hidden">
              <FaUser className="text-gray-300 flex-shrink-0" />
              <span className="truncate max-w-[120px] font-medium text-gray-600">
                {teacher || "Unknown Teacher"}
              </span>
           </div>

           <div className="flex items-center gap-1.5">
              <FaClock className="text-gray-300" />
              <span>{due}</span>
           </div>
        </div>
      </div>
    </div>
  );
}

export default ClassCard;