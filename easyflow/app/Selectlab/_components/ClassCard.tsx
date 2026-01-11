"use client";

import React from "react";

/* =======================
   Props
======================= */
interface ClassCardProps {
  code?: string;
  title?: string;
  problem?: string;
  teacher?: string;
  score?: number | string;
  due?: string;
  isChecked?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
  onCardClick?: () => void; // new: click card to view details
}

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
  return (
    <div
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
      className="bg-white shadow-md rounded-lg overflow-hidden hover:scale-105 transition-all cursor-pointer relative"
    >
      {/* Header */}
      <div className="bg-orange-500 text-white p-4 flex items-center">
        <div className="bg-white rounded-full p-2 mr-3">
          <svg
            className="w-8 h-8 text-black"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div>
          {/* code not shown unless provided intentionally */}
          {code ? <div className="text-xs opacity-90">{code}</div> : null}
          <span className="text-lg font-semibold">{title || "No Title"}</span>
        </div>

        {/* Checkbox */}
        <label
          className="absolute top-4 right-4 z-50"
          onClick={(e) => e.stopPropagation()} // prevent card click when clicking checkbox
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => onCheckboxChange?.(e.target.checked)}
            className="sr-only peer"
            onClick={(e) => e.stopPropagation()} // extra safeguard
            aria-label={`Select ${title || "class card"}`}
          />
          <div className="w-6 h-6 rounded-lg border border-gray-300 bg-white flex items-center justify-center shadow-sm peer-checked:bg-blue-600 peer-checked:border-blue-600">
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
      </div>

      {/* Content */}
      <div className="p-6 h-32">
        <p className="text-gray-800 font-semibold">{problem || "No Problem"}</p>
        <p className="text-gray-600 text-sm">ผู้สร้าง: {teacher || "ไม่ระบุ"}</p>
        <p className="text-gray-600 text-sm">คะแนน: {score ?? "ไม่ระบุ"}</p>
        <p className="text-gray-600 text-sm">กำหนดส่ง: {due || "ไม่ระบุ"}</p>
      </div>
    </div>
  );
}

export default ClassCard;
