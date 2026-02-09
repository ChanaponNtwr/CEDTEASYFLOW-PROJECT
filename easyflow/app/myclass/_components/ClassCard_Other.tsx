"use client";

function ClassCard_Other({ 
  code = '', 
  teacher = '', 
  due = '', 
  problem = '',
  profileImage = '' // รับค่ารูปภาพ
}: {
  code?: string;
  teacher?: string;
  due?: string;
  problem?: string;
  profileImage?: string;
}) {
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden hover:scale-105 transition-all cursor-pointer">
      <div className="bg-orange-500 text-white p-4">
        <div className="flex flex-col">
          <span className="text-lg font-semibold">{code || 'No Code'}</span>
          <span className="text-lg">{teacher || 'No Teacher'}</span>
        </div>
      </div>
      
      <div className="relative flex justify-end -mt-14 mr-6">
        <img
          src={profileImage || "https://img2.pic.in.th/pic/9440461.jpg"}
          alt="Avatar"
          className="h-24 w-24 rounded-full border-4 border-white bg-white object-cover shadow-sm"
        />
      </div>

      <div className="p-10 relative">
        <div className="absolute top-0 left-6">
          <p className="text-gray-600 text-sm">{due || 'No Due Date'}</p>
          <p className="text-gray-800 font-semibold text-base">{problem || 'No Problem'}</p>
        </div>
      </div>
    </div>
  );
}
export default ClassCard_Other;