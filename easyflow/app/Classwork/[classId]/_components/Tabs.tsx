"use client";

import { useRouter } from "next/navigation";

interface TabsProps {
  classId: string;              // ✅ เพิ่ม
  activeTab?: string;
  onTabChange: (tab: string) => void;
}

function Tabs({ classId, activeTab = "Classwork", onTabChange }: TabsProps) {
  const router = useRouter();

  return (
    <div className="flex space-x-4 mb-6">
      {/* Classwork */}
      <button
        className={`px-4 py-2 rounded-full hover:scale-105 transition-all cursor-pointer ${
          activeTab === "Classwork"
            ? "bg-blue-600 text-white"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
        }`}
        onClick={() => {
          onTabChange("Classwork");
          router.push(`/classes/${classId}`); // ✅ ใช้ classId เดิม
        }}
      >
        Classwork
      </button>

      {/* People */}
      <button
        className={`px-4 py-2 rounded-full hover:scale-105 transition-all cursor-pointer ${
          activeTab === "People"
            ? "bg-blue-600 text-white"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
        }`}
        onClick={() => {
          onTabChange("People");
          router.push(`/classes/${classId}/people`); // ✅ class เดียวกัน
        }}
      >
        People
      </button>
    </div>
  );
}

export default Tabs;
