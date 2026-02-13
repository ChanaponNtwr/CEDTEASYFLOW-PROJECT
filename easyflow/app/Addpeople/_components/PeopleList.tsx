"use client";
import React, { useState, useEffect } from "react";
import { FaTrash, FaUserPlus, FaEllipsisV, FaUserTie, FaUserGraduate, FaChalkboardTeacher } from "react-icons/fa";

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element | null;
      // หากคลิกไม่ได้อยู่ภายใน element ที่มี class 'peoplelist-menu' ให้ปิดเมนู
      if (!target || !target.closest(".peoplelist-menu")) {
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

  // Icon mapping
  const TitleIcon = {
    Teacher: FaChalkboardTeacher,
    TA: FaUserTie,
    Students: FaUserGraduate
  }[title];

  // Colors mapping
  const TitleColor = {
    Teacher: "text-blue-600",
    TA: "text-purple-600",
    Students: "text-emerald-600"
  }[title];

  return (
    <div className="w-full">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
        <div className="flex items-center gap-3">
          <h2 className={`text-2xl font-bold ${TitleColor} flex items-center gap-2`}>
             <TitleIcon className="text-xl opacity-80" />
             {title}
          </h2>
          <span className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            {people.length}
          </span>
        </div>
        
        {onAdd && (
          <button 
            onClick={onAdd}
            className="flex items-center gap-2 text-sm font-semibold text-blue-600 bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-colors"
          >
            <FaUserPlus />
            <span className="hidden sm:inline">Add {title}</span>
          </button>
        )}
      </div>

      {/* People List */}
      <div className="space-y-3">
        {people.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 ">
            <FaUserTie className="w-16 h-16 mb-4 text-gray-200" />
            <p className="text-sm text-gray-400">
              No {title} available in this course
            </p>
          </div>
        ) : (
          people.map((person, idx) => {
            const isMe = person.id === currentUserId;
            const isOwnerRow = title === "Teacher" && idx === 0; // Assume first teacher is owner if logic applies
            
            // Logic to show Trash: Owner remove anyone, Self leave class
            const showTrash = (canManage && !isOwnerRow) || (isMe && !isOwnerRow);
            // Logic to show Role Edit: Manage others who are not owner
            const showEditRole = canManage && !isOwnerRow && !isMe;

            return (
              <div 
                key={person.id} 
                className="group relative flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200"
              >
                {/* Left: Avatar & Info */}
                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                  <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm
                    ${title === "Teacher" ? "bg-blue-500" : title === "TA" ? "bg-purple-500" : "bg-emerald-500"}
                  `}>
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  
                  <div className="flex flex-col truncate">
                    <span className="font-semibold text-gray-800 flex items-center gap-2 truncate">
                      {person.name}
                      {isMe && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">YOU</span>}
                      {isOwnerRow && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">OWNER</span>}
                    </span>
                    <span className="text-sm text-gray-500 truncate">{person.email}</span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1 sm:gap-2 ml-4">
                  {/* Remove Button */}
                  {showTrash && onRemove && (
                    <button
                      onClick={() => onRemove(person.id)}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title={isMe ? "Leave Class" : "Remove User"}
                    >
                      <FaTrash size={16} />
                    </button>
                  )}

                  {/* Edit Role Dropdown */}
                  {showEditRole && onRoleChange && (
                    <div className="relative">
                      <button 
                        onClick={() => toggleMenu(person.id)}
                        className="p-2 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <FaEllipsisV size={16} />
                      </button>

                      {openMenuId === person.id && (
                        // เพิ่ม class 'peoplelist-menu' เพื่อให้การตรวจจับการคลิกภายนอกทำงานถูกต้อง
                        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 peoplelist-menu">
                           <div className="py-1">
                              {title !== "Teacher" && (
                                <button onClick={() => handleSelectRole(person.id, "Teacher")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2">
                                    <FaChalkboardTeacher /> Teacher
                                </button>
                              )}
                              {title !== "TA" && (
                                <button onClick={() => handleSelectRole(person.id, "TA")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600 flex items-center gap-2">
                                    <FaUserTie /> TA
                                </button>
                              )}
                              {title !== "Students" && (
                                <button onClick={() => handleSelectRole(person.id, "Students")} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2">
                                    <FaUserGraduate /> Student
                                </button>
                              )}
                           </div>
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
    </div>
  );
};

export default PeopleList;
