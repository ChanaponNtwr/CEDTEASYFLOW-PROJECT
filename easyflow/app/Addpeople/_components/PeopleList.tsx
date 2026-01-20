"use client";
import React, { useState, useEffect, useRef } from "react";
import { FaTrash, FaEllipsisV, FaUserPlus, FaChalkboardTeacher, FaUserGraduate, FaUserTie } from "react-icons/fa";

// ✅ 1. เพิ่ม id ใน Type (จำเป็นต้องใช้ตอนยิง API)
type Person = { 
  id: number; // เพิ่ม id
  name: string; 
  email: string; 
  position?: string;
};

interface PeopleListProps {
  title: "Teacher" | "TA" | "Students";
  people: Person[];
  onAdd?: () => void;
  // ✅ 2. เพิ่ม Prop สำหรับรับฟังก์ชันเปลี่ยน Role
  onRoleChange?: (userId: number, newRole: "Teacher" | "TA" | "Students") => void;
}

const PeopleList: React.FC<PeopleListProps> = ({ title, people, onAdd, onRoleChange }) => {
  // State สำหรับเก็บว่ากำลังเปิดเมนูของ user id ไหนอยู่ (ถ้าไม่มีใครเปิดจะเป็น null)
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  
  // Ref สำหรับตรวจสอบการคลิกนอกเมนูเพื่อปิด
  const menuRef = useRef<HTMLDivElement>(null);

  // Logic ปิดเมนูเมื่อคลิกที่อื่น
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleMenu = (id: number) => {
    setOpenMenuId(openMenuId === id ? null : id);
  };

  const handleSelectRole = (userId: number, role: "Teacher" | "TA" | "Students") => {
    if (onRoleChange) {
      onRoleChange(userId, role);
      setOpenMenuId(null); // ปิดเมนูเมื่อเลือกเสร็จ
    }
  };

  return (
    <div className="mb-10 w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold">{title}</h2>
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
            key={person.id} // ✅ ใช้ ID เป็น key ดีกว่า idx
            className="relative flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow-sm mb-2 hover:bg-gray-50 transition-colors"
          >
            <span className="w-1/3 text-gray-800 font-medium">{person.name}</span>
            <span className="w-1/3 text-gray-600">{person.email}</span>
            
            <div className="w-1/6 flex justify-end items-center space-x-4 relative">
              {/* ซ่อนปุ่มลบสำหรับ Teacher คนแรก (Owner) */}
              {!(title === "Teacher" && idx === 0) && (
                <>
                  <FaTrash className="text-red-400 cursor-pointer hover:text-red-600 transition-colors" title="Remove" />
                  
                  {/* ปุ่ม 3 จุด */}
                  <div className="relative">
                    <FaEllipsisV 
                      className="text-gray-400 cursor-pointer hover:text-gray-600 transition-colors" 
                      onClick={() => toggleMenu(person.id)}
                    />

                    {/* ✅ Dropdown Menu */}
                    {openMenuId === person.id && onRoleChange && (
                      <div 
                        ref={menuRef}
                        className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-hidden"
                      >
                        <div className="text-xs font-semibold text-gray-400 px-4 py-2 bg-gray-50">
                          Change Role to...
                        </div>
                        
                        {/* Option: Teacher */}
                        {title !== "Teacher" && (
                          <button 
                            onClick={() => handleSelectRole(person.id, "Teacher")}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                          >
                            <FaChalkboardTeacher /> Teacher
                          </button>
                        )}

                        {/* Option: TA */}
                        {title !== "TA" && (
                          <button 
                            onClick={() => handleSelectRole(person.id, "TA")}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                          >
                            <FaUserTie /> TA
                          </button>
                        )}

                        {/* Option: Student */}
                        {title !== "Students" && (
                          <button 
                            onClick={() => handleSelectRole(person.id, "Students")}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                          >
                            <FaUserGraduate /> Student
                          </button>
                        )}
                      </div>
                    )}
                  </div>
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