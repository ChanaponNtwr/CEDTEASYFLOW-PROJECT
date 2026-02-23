"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

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
  // <-- อนุญาต null ด้วย เพื่อให้สอดคล้องกับ PageLabData | null ที่ส่งมาจากพาเรนต์
  labData?: LabData | null; 
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

  useEffect(() => {
    // ตรวจสอบทั้ง undefined และ null ก่อนใช้งาน
    if (labData != null) {
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

  const SymbolItemComponent: React.FC<{ item: SymbolItem }> = ({ item }) => (
    <div className="group flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:shadow-lg hover:border-gray-300 transition-all duration-200">
      <div className="flex items-center gap-5">
        {/* ปรับขนาด Container รูปตรงนี้ (w-24 h-14) ใหญ่ขึ้นชัดเจน */}
        <div className="w-24 h-14 flex items-center justify-center bg-gray-50 rounded-lg p-1 border border-gray-100 overflow-hidden relative">
             <Image
              src={item.imageSrc}
              alt={item.label}
              fill // ใช้ fill เพื่อให้รูปขยายเต็มพื้นที่ Container
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-contain p-1 group-hover:scale-110 transition-transform duration-300"
            />
        </div>
        <span className="text-base font-bold text-gray-700">{item.label}</span>
      </div>

      <div className="">
        {item.isUnlimited ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                Unlimited
            </span>
        ) : (
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                {item.count}
            </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8"> {/* เพิ่ม Gap เป็น 8 */}
        
        {/* Column 1: Input / Output */}
        <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-5">
             <div className="w-1.5 h-5 bg-blue-500 rounded-full shadow-sm shadow-blue-200"></div>
             <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Input / Output</h3>
          </div>
          <div className="space-y-4">
            <SymbolItemComponent item={symbols.input} />
            <SymbolItemComponent item={symbols.output} />
          </div>
        </div>

        {/* Column 2: Variables */}
        <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
           <div className="flex items-center gap-3 mb-5">
             <div className="w-1.5 h-5 bg-yellow-500 rounded-full shadow-sm shadow-yellow-200"></div>
             <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Variables</h3>
          </div>
          <div className="space-y-4">
            <SymbolItemComponent item={symbols.declare} />
            <SymbolItemComponent item={symbols.assign} />
          </div>
        </div>

        {/* Column 3: Control */}
        <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
           <div className="flex items-center gap-3 mb-5">
             <div className="w-1.5 h-5 bg-pink-500 rounded-full shadow-sm shadow-pink-200"></div>
             <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Control Flow</h3>
          </div>
          <div className="space-y-4">
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