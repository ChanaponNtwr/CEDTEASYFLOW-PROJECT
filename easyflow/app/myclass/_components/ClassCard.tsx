"use client";
import { FaTrash } from "react-icons/fa";

interface ClassCardProps {
  code?: string;
  teacher?: string;
  due?: string;
  problem?: string;
  profileImage?: string; // รับ URL รูปภาพ
  onDeleteClick?: () => void;
}

function ClassCard({
  code = '',
  teacher = '',
  due = '',
  problem = '',
  profileImage,
  onDeleteClick,
}: ClassCardProps) {
  return (
    <div className="relative bg-white shadow-md rounded-lg overflow-hidden hover:scale-105 transition-all cursor-pointer">
      
      {/* ปุ่มลบ */}
      {onDeleteClick && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDeleteClick();
          }}
          title="Delete Class"
          className="absolute top-2 right-2 z-10 bg-white text-red-500 hover:text-red-700 p-2 rounded-full shadow"
          aria-label="delete-class"
        >
          <FaTrash size={14} />
        </button>
      )}

      {/* Header สีส้ม */}
      <div className="bg-orange-500 text-white p-4">
        <div className="flex flex-col">
          <span className="text-lg font-semibold">{code || 'No Code'}</span>
          <span className="text-lg">{teacher || 'No Teacher'}</span>
        </div>
      </div>

      {/* Avatar Section */}
      <div className="relative flex justify-end -mt-14 mr-6">
        <img
          // ถ้าไม่มีรูปส่งมา ให้ใช้รูป Placeholder เดิม
          src={profileImage || "https://img2.pic.in.th/pic/9440461.jpg"}
          alt="Avatar"
          // bg-white สำคัญมากสำหรับรูป SVG เพื่อไม่ให้พื้นหลังทะลุ
          className="h-24 w-24 rounded-full border-4 border-white bg-white object-cover shadow-sm"
        />
      </div>

      {/* Content Body */}
      <div className="p-10 relative">
        <div className="absolute top-0 left-6">
          <p className="text-gray-600 text-sm">{due || 'No Due Date'}</p>
          <p className="text-gray-800 font-semibold text-base">{problem || 'No Problem'}</p>
        </div>
      </div>
    </div>
  );
}

export default ClassCard;