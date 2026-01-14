"use client";
import React from "react";
import { FaTrash, FaEllipsisV, FaUserPlus } from "react-icons/fa";

type Person = { name: string; email: string; position?: string };

interface PeopleListProps {
  title: "Teacher" | "TA" | "Students";
  people: Person[];
  onAdd?: () => void; // ✅ แก้เป็น Optional (?) เพื่อรองรับกรณีไม่มีสิทธิ์
}

const PeopleList: React.FC<PeopleListProps> = ({ title, people, onAdd }) => {
  return (
    <div className="mb-10 w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold">{title}</h2>
        
        {/* ✅ แสดงปุ่ม Add เฉพาะเมื่อ onAdd ถูกส่งมา (มีสิทธิ์) */}
        {onAdd && (
          <FaUserPlus
            className="text-gray-600 hover:text-black cursor-pointer text-xl"
            onClick={onAdd}
            title="Add Member"
          />
        )}
      </div>
      <hr className="border-t border-gray-300 mb-4" />

      {/* Table header */}
      <div className="flex justify-between text-gray-500 text-sm font-medium mb-2 px-2">
        <span className="w-1/3">ชื่อ</span>
        <span className="w-1/3">อีเมล</span>
        <span className="w-1/6 text-right">การจัดการ</span>
      </div>

      {/* People list */}
      {people.length === 0 ? (
        <div className="text-center text-gray-400 py-4 italic">No {title} in this class yet.</div>
      ) : (
        people.map((person, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow-sm mb-2 hover:bg-gray-50 transition-colors"
          >
            <span className="w-1/3 text-gray-800 font-medium">{person.name}</span>
            <span className="w-1/3 text-gray-600">{person.email}</span>
            <div className="w-1/6 flex justify-end items-center space-x-4">
              {/* ซ่อนปุ่มลบสำหรับ Teacher คนแรก (Owner) */}
              {!(title === "Teacher" && idx === 0) && (
                <>
                  <FaTrash className="text-red-400 cursor-pointer hover:text-red-600 transition-colors" title="Remove" />
                  <FaEllipsisV className="text-gray-400 cursor-pointer hover:text-gray-600 transition-colors" />
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default PeopleList;