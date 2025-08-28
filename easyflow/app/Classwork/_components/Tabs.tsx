"use client";

import { useRouter } from "next/navigation";

interface TabsProps {
  activeTab?: string;
  onTabChange: (tab: string) => void;
}

function Tabs({ activeTab = "People", onTabChange }: TabsProps) {
  const router = useRouter();

  return (
    <div className="flex space-x-4 mb-6">
      {/* Classwork */}
      <button
        className={`px-4 py-2 rounded-full hover:scale-105 transition-all cursor-pointer ${
          activeTab === "People"
            ? "bg-blue-600 text-white"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
        }`}
        onClick={() => {
          onTabChange("Classwork");
          router.push("/Classwork");
        }}
      >
        Classwork
      </button>

      {/* People */}
      <button
        className={`px-4 py-2 rounded-full hover:scale-105 transition-all cursor-pointer ${
          activeTab === "Classwork"
            ? "bg-blue-600 text-white"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
        }`}
        onClick={() => {
          onTabChange("People");
          router.push("/Addpeople");
        }}
      >
        People
      </button>
    </div>
  );
}

export default Tabs;
