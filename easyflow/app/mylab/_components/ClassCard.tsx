"use client";

function ClassCard({ title = '', problem = '', teacher = '', score = '', due = '' }) {
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden hover:scale-105 transition-all cursor-pointer">
      {/* Header Section */}
      <div className="bg-orange-500 text-white p-4 flex items-center">
         <div className="w-15 h-15 bg-[#EEEEEE] rounded-full flex items-center justify-center mr-4">
           <img src="/images/lab.png" className="w-8 h-10" />
          </div>
        <span className="text-lg font-semibold">{title || 'No Title'}</span>
      </div>

      {/* Content Section */}
      <div className="p-6 h-32">
        <p className="text-gray-800 font-semibold text-base">{problem || 'No Problem'}</p>
        <p className="text-gray-600 text-sm mt-1">ผู้สร้าง: {teacher || 'ไม่ระบุ'}</p>
        <p className="text-gray-600 text-sm mt-1">คะแนน: {score || 'ไม่ระบุ'}</p>
        <p className="text-gray-600 text-sm mt-1">กำหนดส่ง: {due || 'ไม่ระบุ'}</p>
      </div>
    </div>
  );
}

export default ClassCard;