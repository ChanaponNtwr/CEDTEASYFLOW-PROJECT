"use client"; // ระบุว่าเป็นคอมโพเนนต์ฝั่งไคลเอนต์สำหรับ Next.js App Router

interface TabsProps {
  activeTab?: string;
  onTabChange: (tab: string) => void;
}

function Tabs({ activeTab = "Classwork", onTabChange }: TabsProps) {
  return (
    <div className="flex space-x-4 mb-6">
      {/* Classwork → สีน้ำเงิน */}
      <button
        className="px-4 py-2 rounded-full hover:scale-105 transition-all cursor-pointer bg-gray-200 text-gray-700 hover:bg-gray-300"
        onClick={() => onTabChange("Classwork")}
      >
        Classwork
      </button>

      {/* People → สีเทา */}
      <button
        className=" px-4 py-2 rounded-full hover:scale-105 transition-all cursor-pointer bg-blue-600 text-white"
        onClick={() => onTabChange("People")}
      >
        People
      </button>
    </div>
  );
}

export default Tabs;
