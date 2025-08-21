"use client";

import React, { useState } from "react";

interface ClassCardProps {
  title?: string;
  problem?: string;
  teacher?: string;
  score?: string;
  due?: string;
  isChecked?: boolean;
  onCheckboxChange?: (checked: boolean) => void;
}

function ClassCard({
  title = "",
  problem = "",
  teacher = "",
  score = "",
  due = "",
  isChecked = false,
  onCheckboxChange,
}: ClassCardProps) {
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden hover:scale-105 transition-all cursor-pointer">
      {/* Header Section */}
      <div className="bg-orange-500 text-white p-4 flex items-center relative">
        <div className="bg-white rounded-full p-2 mr-3">
          <svg
            className="w-8 h-8 text-black"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v14a2 2 0 01-2 2z"
            ></path>
          </svg>
        </div>
        <span className="text-lg font-semibold">{title || "No Title"}</span>
        {/* Checkbox in top-right corner */}
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            console.log("Checkbox changed:", e.target.checked); // Debug log
            onCheckboxChange?.(e.target.checked);
          }}
          className="absolute top-4 right-4 w-5 h-5 accent-green-500 border-gray-300 rounded cursor-pointer focus:ring-2 focus:ring-green-500 z-50"
          aria-label={`Select ${title || "class card"}`}
        />
      </div>

      {/* Content Section */}
      <div className="p-6 h-32">
        <p className="text-gray-800 font-semibold text-base">{problem || "No Problem"}</p>
        <p className="text-gray-600 text-sm mt-1">ผู้สร้าง: {teacher || "ไม่ระบุ"}</p>
        <p className="text-gray-600 text-sm mt-1">คะแนน: {score || "ไม่ระบุ"}</p>
        <p className="text-gray-600 text-sm mt-1">กำหนดส่ง: {due || "ไม่ระบุ"}</p>
      </div>
    </div>
  );
}

function App() {
  const classes = [
    { title: "Math Class", problem: "Algebra Homework", teacher: "Mr. Smith", score: "100", due: "2025-08-25" },

  ];

  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

  const handleCheckboxChange = (title: string) => {
    setSelectedTitle(title); // เลือกตัวเดียว จะ override ตัวเก่า
  };

  return (
    <div className="p-4 space-y-4">
      {classes.map((cls) => (
        <ClassCard
          key={cls.title}
          title={cls.title}
          problem={cls.problem}
          teacher={cls.teacher}
          score={cls.score}
          due={cls.due}
          isChecked={selectedTitle === cls.title} // true ถ้าเป็นตัวที่เลือก
          onCheckboxChange={() => handleCheckboxChange(cls.title)}
        />
      ))}
    </div>
  );
}

export default App;