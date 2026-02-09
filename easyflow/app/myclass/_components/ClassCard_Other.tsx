"use client";
import React, { useMemo } from "react";
import { FaUser, FaClock } from "react-icons/fa";

interface ClassCardOtherProps {
  code?: string;
  title?: string;
  teacher?: string;
  due?: string;
  problem?: string;
  profileImage?: string;
}

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

const getGradient = (id: string) => {
  const str = String(id || "default");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
};

function ClassCard_Other({
  code = "",
  title = "",
  teacher = "",
  due = "",
  problem = "",
  profileImage,
}: ClassCardOtherProps) {
  
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
      {/* Header Section */}
      <div className={`h-24 bg-gradient-to-r ${bgGradient} p-5 relative`}>
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
        <div className="mb-2">
            <h3 className="text-lg font-bold text-gray-800 truncate" title={title || code}>
            {title || code || "Untitled Class"}
            </h3>
            {/* <p className="text-xs font-semibold text-gray-500 bg-gray-100 inline-block px-2 py-0.5 rounded-md mt-1">
                {problem || "Student"}
            </p> */}
        </div>

        <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
           <div className="flex items-center gap-2 overflow-hidden">
              <FaUser className="text-gray-300 flex-shrink-0" />
              <span className="truncate max-w-[120px] font-medium text-gray-600">
                {teacher || "Unknown"}
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

export default ClassCard_Other;