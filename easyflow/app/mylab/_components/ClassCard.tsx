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
  score = "",
  due = ""
}: ClassCardProps) {
  const headerTitle = title || (code ? `Lab ${code}` : "No Title");

  return (
    <div
      className="bg-white shadow-md rounded-lg overflow-hidden hover:scale-105 transition-all cursor-pointer"
      role="button"
      tabIndex={0}
    >
      <div className="bg-orange-500 text-white p-4 flex items-center">
        <div className="w-12 h-12 bg-[#EEEEEE] rounded-full flex items-center justify-center mr-4">
          <img src="/images/lab.png" alt="lab icon" className="w-8 h-8" />
        </div>
        <span className="text-lg font-semibold">{headerTitle}</span>
      </div>

      <div className="p-6 h-32">
        <p className="text-gray-800 font-semibold text-base">{problem || 'No Problem'}</p>
        <p className="text-gray-600 text-sm mt-1">ผู้สร้าง: {teacher || 'ไม่ระบุ'}</p>
        <p className="text-gray-600 text-sm mt-1">คะแนน: {score ?? 'ไม่ระบุ'}</p>
        <p className="text-gray-600 text-sm mt-1">กำหนดส่ง: {due || 'ไม่ระบุ'}</p>
      </div>
    </div>
  );
}

export default ClassCard;
