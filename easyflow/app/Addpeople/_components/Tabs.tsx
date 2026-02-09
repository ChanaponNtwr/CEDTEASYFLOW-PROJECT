"use client";

import { useRouter, useParams } from "next/navigation";

interface TabsProps {
  activeTab?: string;
  onTabChange: (tab: string) => void;
}

function Tabs({ activeTab = "Classwork", onTabChange }: TabsProps) {
  const router = useRouter();
  const params = useParams();
  const classId = params?.classId as string;

  const tabs = [
    { name: "Classwork", path: `/classes/${classId}` },
    { name: "People", path: `/classes/${classId}/people` },
  ];

  // Removed border-b from the parent div
  return (
    <div className="flex items-center space-x-2 pb-1 mb-6">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.name;
        return (
          <button
            key={tab.name}
            onClick={() => {
              onTabChange(tab.name);
              router.push(tab.path);
            }}
            className={`
              relative px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200
              ${isActive 
                ? "bg-blue-600 text-white shadow-md shadow-blue-200" 
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }
            `}
          >
            {tab.name}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;