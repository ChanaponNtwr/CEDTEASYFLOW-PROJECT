"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

// --- Interfaces ---
interface LabData {
  inSymVal: number;
  outSymVal: number;
  declareSymVal: number;
  assignSymVal: number;
  ifSymVal: number;
  forSymVal: number;
  whileSymVal: number;
}

interface SymbolItem {
  label: string;
  bgColor: string;
  textColor: string;
  count: number;
  isUnlimited: boolean;
  imageSrc: string;
}

interface SymbolSectionProps {
  labData?: LabData; 
}

const SymbolSection: React.FC<SymbolSectionProps> = ({ labData }) => {
  const [symbols, setSymbols] = useState({
    input: { label: "Input", bgColor: "bg-blue-200", textColor: "text-blue-800", count: 0, isUnlimited: false, imageSrc: "/images/input.png" },
    output: { label: "Output", bgColor: "bg-green-200", textColor: "text-green-800", count: 0, isUnlimited: false, imageSrc: "/images/output.png" },
    declare: { label: "Declare", bgColor: "bg-yellow-200", textColor: "text-yellow-800", count: 0, isUnlimited: false, imageSrc: "/images/declare.png" },
    assign: { label: "Assign", bgColor: "bg-yellow-200", textColor: "text-yellow-800", count: 0, isUnlimited: false, imageSrc: "/images/assign.png" },
    if: { label: "IF", bgColor: "bg-pink-200", textColor: "text-pink-800", count: 0, isUnlimited: false, imageSrc: "/images/if.png" },
    while: { label: "While", bgColor: "bg-indigo-200", textColor: "text-indigo-800", count: 0, isUnlimited: false, imageSrc: "/images/while.png" },
    for: { label: "For", bgColor: "bg-teal-200", textColor: "text-teal-800", count: 0, isUnlimited: false, imageSrc: "/images/for.png" },
  });

  // Sync State with API Data
  useEffect(() => {
    if (labData) {
      const checkUnlimited = (val: number | undefined) => (val === -1);
      const getCount = (val: number | undefined) => (val === -1 ? 0 : val ?? 0);

      setSymbols((prev) => ({
        ...prev,
        input: { ...prev.input, count: getCount(labData.inSymVal), isUnlimited: checkUnlimited(labData.inSymVal) },
        output: { ...prev.output, count: getCount(labData.outSymVal), isUnlimited: checkUnlimited(labData.outSymVal) },
        declare: { ...prev.declare, count: getCount(labData.declareSymVal), isUnlimited: checkUnlimited(labData.declareSymVal) },
        assign: { ...prev.assign, count: getCount(labData.assignSymVal), isUnlimited: checkUnlimited(labData.assignSymVal) },
        if: { ...prev.if, count: getCount(labData.ifSymVal), isUnlimited: checkUnlimited(labData.ifSymVal) },
        for: { ...prev.for, count: getCount(labData.forSymVal), isUnlimited: checkUnlimited(labData.forSymVal) },
        while: { ...prev.while, count: getCount(labData.whileSymVal), isUnlimited: checkUnlimited(labData.whileSymVal) },
      }));
    }
  }, [labData]);

  // Component สำหรับแต่ละ Item
  const SymbolItemComponent: React.FC<{ item: SymbolItem }> = ({ item }) => (
    <div className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center gap-4">
        {/* กล่องรูปภาพ - กำหนดขนาดให้ชัดเจน */}
        <div className="w-24 h-14 flex items-center justify-center relative">
             <Image
              src={item.imageSrc}
              alt={item.label}
              fill // ใช้ fill เพื่อให้รูปขยายเต็มพื้นที่ Container
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-contain p-1 group-hover:scale-110 transition-transform duration-300"
            />
        </div>
        <span className="font-bold text-gray-700 text-sm">{item.label}</span>
      </div>

      <div className="">
        {item.isUnlimited ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                Unlimited
            </span>
        ) : (
            <span className="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100">
                {item.count}
            </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full">
      {/* Grid Layout แบ่ง 3 คอลัมน์เหมือนในตัวอย่าง */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Input / Output */}
        <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
             <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
             <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Input / Output</h3>
          </div>
          <div className="space-y-3">
            <SymbolItemComponent item={symbols.input} />
            <SymbolItemComponent item={symbols.output} />
          </div>
        </div>

        {/* Column 2: Variables */}
        <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100">
           <div className="flex items-center gap-2 mb-4">
             <div className="w-1 h-5 bg-yellow-500 rounded-full"></div>
             <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Variables</h3>
          </div>
          <div className="space-y-3">
            <SymbolItemComponent item={symbols.declare} />
            <SymbolItemComponent item={symbols.assign} />
          </div>
        </div>

        {/* Column 3: Control */}
        <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100">
           <div className="flex items-center gap-2 mb-4">
             <div className="w-1 h-5 bg-pink-500 rounded-full"></div>
             <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Control Flow</h3>
          </div>
          <div className="space-y-3">
            <SymbolItemComponent item={symbols.if} />
            <SymbolItemComponent item={symbols.while} />
            <SymbolItemComponent item={symbols.for} />
          </div>
        </div>

      </div>
    </div>
  );
};

export default SymbolSection;