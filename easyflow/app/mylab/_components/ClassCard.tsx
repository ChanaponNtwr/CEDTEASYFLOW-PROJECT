"use client";
import React from "react";

type ClassCardProps = {
  code?: string | number;
  title?: string;
  problem?: string;
  teacher?: string;
  score?: string | number;
  due?: string;
};

function ClassCard({
  code,
  title = "",
  problem = "",
  teacher = "",
  score,
  due = ""
}: ClassCardProps) {
  const headerTitle = title || (code ? `Lab ${code}` : "No Title");

  return (
    <div
      className="
        bg-white rounded-lg overflow-hidden
        shadow-md hover:shadow-lg
        hover:scale-[1.02]
        transition-all duration-200
        cursor-pointer
      "
      role="button"
      tabIndex={0}
    >
      {/* Header */}
      <div className="bg-orange-500 text-white p-4 flex items-center gap-4">
        <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center">
          <img src="/images/lab.png" alt="lab icon" className="w-7 h-7" />
        </div>
        <span className="text-lg font-semibold truncate">
          {headerTitle}
        </span>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-200" />

      {/* Body */}
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

          <p>
            กำหนดส่ง:{" "}
            <span className="font-medium text-gray-700">
              {due || "ไม่ระบุ"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default ClassCard;
