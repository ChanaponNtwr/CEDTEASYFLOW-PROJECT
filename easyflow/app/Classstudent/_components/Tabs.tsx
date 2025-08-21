"use client"; // ระบุว่าเป็นคอมโพเนนต์ฝั่งไคลเอนต์สำหรับ Next.js App Router

// กำหนดประเภทของ props ด้วย TypeScript
interface TabsProps {
  activeTab?: string;
  onTabChange: (tab: string) => void;
}

function Tabs({ activeTab = "Classwork", onTabChange }: TabsProps) {
  return (
    <div className="flex space-x-4 mb-6">
      <button
        className={`px-4 py-2 rounded-full hover:scale-105 transition-all cursor-pointer ${
          activeTab === "Classwork"
            ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
            : "bg-blue-600 text-white"
        }`}
        onClick={() => onTabChange("Classwork")}
      >
        Classwork
      </button>
      <button
        className={`px-4 py-2 rounded-full hover:scale-105 transition-all cursor-pointer ${
          activeTab === "People"
            ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
            : "bg-blue-600 text-white"
        }`}
        onClick={() => onTabChange("People")}
      >
        People
      </button>
    </div>
  );
}

export default Tabs;
