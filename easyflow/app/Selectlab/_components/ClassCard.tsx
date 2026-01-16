"use client";

import React from "react";

/* =======================
   Props
======================= */
type ClassCardProps = {
  // Data Props (from target design)
  code?: string | number;
  title?: string;
  problem?: string;
  teacher?: string;
  score?: string | number;
  due?: string;
  
  // Functional Props (from original logic)
  isChecked?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
  onCardClick?: () => void;
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
  
  // Logic การแสดงชื่อหัวข้อ (เหมือนโค้ดใหม่)
  const headerTitle = title || (code ? `Lab ${code}` : "No Title");

  return (
    <div
      // 1. Container Styles: ใช้สไตล์ใหม่ (hover:scale-[1.02], shadow) + cursor-pointer
      className="
        bg-white rounded-lg overflow-hidden
        shadow-md hover:shadow-lg
        hover:scale-[1.02]
        transition-all duration-200
        cursor-pointer
        relative
      "
      // 2. Interactive Handlers: ยังคง logic การคลิกการ์ดแบบเดิม
      role={onCardClick ? "button" : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      onClick={() => onCardClick?.()}
      onKeyDown={(e) => {
        if (!onCardClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      }}
    >
      {/* Header: ใช้ดีไซน์ใหม่ (สีส้ม) */}
      <div className="bg-orange-500 text-white p-4 flex items-center gap-4">
        {/* Icon: เปลี่ยนจาก SVG เป็นรูปภาพตามโค้ดใหม่ */}
        <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center shrink-0">
          <img src="/images/lab.png" alt="lab icon" className="w-7 h-7" />
        </div>
        
        {/* Title */}
        <span className="text-lg font-semibold truncate pr-8">
          {headerTitle}
        </span>

        {/* 3. Checkbox Logic: นำส่วนเลือกมาวางซ้อนใน Header */}
        {onCheckboxChange && (
          <label
            className="absolute top-4 right-4 z-50 cursor-pointer"
            onClick={(e) => e.stopPropagation()} // ป้องกันการคลิกทะลุไปโดนการ์ด
            onKeyDown={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => onCheckboxChange(e.target.checked)}
              className="sr-only peer"
            />
            {/* Custom Checkbox UI (ใช้ Style เดิมเพื่อให้เห็นชัดบนพื้นขาว/ส้ม) */}
            <div className="w-6 h-6 rounded-lg border border-gray-300 bg-white flex items-center justify-center shadow-sm peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-colors">
              <svg
                className="w-4 h-4 text-white opacity-0 peer-checked:opacity-100"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </label>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-200" />

      {/* Body: ใช้ดีไซน์ใหม่ */}
      <div className="p-5 h-36 flex flex-col justify-between">
        {/* Problem */}
        <p className="text-gray-800 font-semibold text-sm line-clamp-2">
          {problem || "No Problem"}
        </p>

        {/* Meta info */}
        <div className="mt-3 space-y-1 text-sm text-gray-600">
          <p>
            ผู้สร้าง:{" "}
            <span className="font-medium text-gray-700">
              {teacher || "ไม่ระบุ"}
            </span>
          </p>

          {score !== undefined && (
            <p>
              คะแนน:{" "}
              <span className="font-medium text-gray-700">
                {score}
              </span>
            </p>
          )}

          {/* Uncomment ถ้าต้องการแสดงวันส่ง */}
          {/* <p>
            กำหนดส่ง:{" "}
            <span className="font-medium text-gray-700">
              {due || "ไม่ระบุ"}
            </span>
          </p> */}
        </div>
      </div>
    </div>
  );
}

export default ClassCard;