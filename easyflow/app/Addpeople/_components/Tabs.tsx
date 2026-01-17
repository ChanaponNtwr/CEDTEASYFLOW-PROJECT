"use client";

import { useRouter, useParams } from "next/navigation";

interface TabsProps {
  activeTab?: string;
  onTabChange: (tab: string) => void;
}

function Tabs({ activeTab = "Classwork", onTabChange }: TabsProps) {
  const router = useRouter();
  const { classId } = useParams<{ classId: string }>();

  return (
    <div className="flex space-x-4 mb-6">
      {/* Classwork (น้ำเงินเสมอ) */}
      <button
        className="px-4 py-2 rounded-full hover:scale-105 transition-all cursor-pointer bg-blue-600 text-white"
        onClick={() => {
          onTabChange("Classwork");
          router.push(`/classes/${classId}`);
        }}
      >
        Classwork
      </button>

      {/* People (เทาเสมอ) */}
      <button
        className="px-4 py-2 rounded-full hover:scale-105 transition-all cursor-pointer bg-gray-200 text-gray-700 hover:bg-gray-300"
        onClick={() => {
          onTabChange("People");
          router.push(`/classes/${classId}/people`);
        }}
      >
        People
      </button>
    </div>
  );
}

export default Tabs;
