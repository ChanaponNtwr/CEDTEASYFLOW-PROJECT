"use client";

import React from "react";
import Image from "next/image";

interface SymbolItem {
  label: string;
  bgColor: string;
  textColor: string;
  imageSrc: string;
}

// แบ่งกลุ่มตามประเภท
const symbolGroups: Record<string, SymbolItem[]> = {
  "Input / Output": [
    { label: "Input", bgColor: "bg-blue-200", textColor: "text-blue-800", imageSrc: "/images/input.png" },
    { label: "Output", bgColor: "bg-green-200", textColor: "text-green-800", imageSrc: "/images/output.png" },
  ],
  Variables: [
    { label: "Declare", bgColor: "bg-yellow-200", textColor: "text-yellow-800", imageSrc: "/images/declare.png" },
    { label: "Assign", bgColor: "bg-yellow-200", textColor: "text-yellow-800", imageSrc: "/images/assign.png" },
  ],
  Control: [
    { label: "IF", bgColor: "bg-pink-200", textColor: "text-pink-800", imageSrc: "/images/if.png" },
    { label: "Call", bgColor: "bg-purple-200", textColor: "text-purple-800", imageSrc: "/images/call.png" },
    { label: "While", bgColor: "bg-indigo-200", textColor: "text-indigo-800", imageSrc: "/images/while.png" },
    { label: "For", bgColor: "bg-teal-200", textColor: "text-teal-800", imageSrc: "/images/for.png" },
    { label: "Do", bgColor: "bg-orange-200", textColor: "text-orange-800", imageSrc: "/images/do.png" },
  ],
};

const SymbolSection: React.FC = () => {
  return (
    <div className="flex flex-col gap-6">
      {Object.keys(symbolGroups).map((groupName) => (
        <div key={groupName}>
          <h3 className="text-lg font-medium text-gray-700 mb-2">{groupName}</h3>
          <div className="flex gap-4 flex-wrap">
            {symbolGroups[groupName].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-center cursor-pointer"
                style={{ width: 120, height: 100 }} // กำหนดกรอบใหญ่ขึ้น
              >
                <Image
                  src={item.imageSrc}
                  alt={item.label}
                  width={100}
                  height={80}
                  className={`${item.bgColor} ${item.textColor} rounded`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SymbolSection;
