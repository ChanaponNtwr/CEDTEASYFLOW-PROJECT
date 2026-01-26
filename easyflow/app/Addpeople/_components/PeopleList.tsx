"use client";
import React, { useState, useEffect, useRef } from "react";
import { FaTrash, FaEllipsisV, FaUserPlus, FaChalkboardTeacher, FaUserGraduate, FaUserTie } from "react-icons/fa";

type Person = { 
  id: number; 
  name: string; 
  email: string; 
  position?: string;
};

interface PeopleListProps {
  title: "Teacher" | "TA" | "Students";
  people: Person[];
  onAdd?: () => void;
  onRoleChange?: (userId: number, newRole: "Teacher" | "TA" | "Students") => void;
  // ✅ เพิ่ม Props สำหรับการลบและสิทธิ์
  onRemove?: (userId: number) => void;
  canManage?: boolean;
  currentUserId?: number;
}

const PeopleList: React.FC<PeopleListProps> = ({ 
  title, 
  people, 
  onAdd, 
  onRoleChange, 
  onRemove, 
  canManage, 
  currentUserId 
}) => {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
      setOpenMenuId(null);
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
        people.map((person, idx) => {
            // Logic การแสดงผลปุ่มลบ
            const isMe = person.id === currentUserId;
            // สมมติว่า Teacher คนแรกคือ Owner ตาม Logic เดิม
            const isOwnerRow = title === "Teacher" && idx === 0; 
            
            // แสดงถังขยะเมื่อ:
            // 1. เรามีสิทธิ์ Manage (Teacher/Owner) และแถวนั้นไม่ใช่ Owner (ลบคนอื่นได้)
            // 2. หรือ แถวนั้นคือเราเอง และเราไม่ใช่ Owner (User กด Leave Class)
            const showTrash = (canManage && !isOwnerRow) || (isMe && !isOwnerRow);

            // แสดงปุ่ม Edit Role เมื่อมีสิทธิ์ Manage และไม่ใช่ Owner (และไม่ใช่ตัวเองด้วย เพื่อป้องกันเปลี่ยน Role ตัวเองจนเสียสิทธิ์)
            const showEditRole = canManage && !isOwnerRow && !isMe;

            return (
                <div
                    key={person.id}
                    className="relative flex items-center justify-between bg-white px-4 py-3 rounded-lg shadow-sm mb-2 hover:bg-gray-50 transition-colors"
                >
                    <span className="w-1/3 text-gray-800 font-medium">
                        {person.name} {isMe && <span className="text-xs text-blue-500">(You)</span>}
                    </span>
                    <span className="w-1/3 text-gray-600">{person.email}</span>
                    
                    <div className="w-1/6 flex justify-end items-center space-x-4 relative">
                        {/* ✅ ปุ่มลบ (Kick หรือ Leave) */}
                        {showTrash && onRemove && (
                            <FaTrash 
                                className="text-red-400 cursor-pointer hover:text-red-600 transition-colors" 
                                title={isMe ? "Leave Class" : "Remove User"} 
                                onClick={() => onRemove(person.id)}
                            />
                        )}
                        
                        {/* ✅ ปุ่มเปลี่ยน Role (3 จุด) */}
                        {showEditRole && (
                            <div className="relative">
                                <FaEllipsisV 
                                className="text-gray-400 cursor-pointer hover:text-gray-600 transition-colors" 
                                onClick={() => toggleMenu(person.id)}
                                />

                                {openMenuId === person.id && onRoleChange && (
                                <div 
                                    ref={menuRef}
                                    className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-hidden"
                                >
                                    <div className="text-xs font-semibold text-gray-400 px-4 py-2 bg-gray-50">
                                    Change Role to...
                                    </div>
                                    
                                    {title !== "Teacher" && (
                                    <button 
                                        onClick={() => handleSelectRole(person.id, "Teacher")}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                    >
                                        <FaChalkboardTeacher /> Teacher
                                    </button>
                                    )}

                                    {title !== "TA" && (
                                    <button 
                                        onClick={() => handleSelectRole(person.id, "TA")}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                    >
                                        <FaUserTie /> TA
                                    </button>
                                    )}

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
                        )}
                    </div>
                </div>
            );
        })
      )}
    </div>
  );
};

export default PeopleList;