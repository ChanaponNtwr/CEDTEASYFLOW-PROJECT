"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

// 1. Define the shape of the Lab Data from your API
// ตัด callSymVal และ doSymVal ออกตาม requirement
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
  // ตัด call และ do ออกจาก State
  const [symbols, setSymbols] = useState({
    input: { label: "Input", bgColor: "bg-blue-200", textColor: "text-blue-800", count: 0, isUnlimited: false, imageSrc: "/images/input.png" },
    output: { label: "Output", bgColor: "bg-green-200", textColor: "text-green-800", count: 0, isUnlimited: false, imageSrc: "/images/output.png" },
    declare: { label: "Declare", bgColor: "bg-yellow-200", textColor: "text-yellow-800", count: 0, isUnlimited: false, imageSrc: "/images/declare.png" },
    assign: { label: "Assign", bgColor: "bg-yellow-200", textColor: "text-yellow-800", count: 0, isUnlimited: false, imageSrc: "/images/assign.png" },
    if: { label: "IF", bgColor: "bg-pink-200", textColor: "text-pink-800", count: 0, isUnlimited: false, imageSrc: "/images/if.png" },
    while: { label: "While", bgColor: "bg-indigo-200", textColor: "text-indigo-800", count: 0, isUnlimited: false, imageSrc: "/images/while.png" },
    for: { label: "For", bgColor: "bg-teal-200", textColor: "text-teal-800", count: 0, isUnlimited: false, imageSrc: "/images/for.png" },
  });

  // 3. Sync State with API Data
  useEffect(() => {
    if (labData) {
      // Logic: ถ้าค่าเป็น -1 ให้ถือว่าเป็น Unlimited
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

  // Component สำหรับแสดงผลแต่ละแถว (ตัดปุ่ม + - ออก)
  const SymbolItemComponent: React.FC<{ item: SymbolItem }> = ({ item }) => (
    <div className="flex items-center justify-between w-92 p-2 border-b border-gray-200 ">
      {/* ฝั่งซ้าย: รูป + Label */}
      <div className="flex flex-col items-start">
        <Image
          src={item.imageSrc}
          alt={item.label}
          width={150}
          height={90}
          className={`${item.bgColor} ${item.textColor} rounded`}
        />
      </div>

      {/* ฝั่งขวา: แสดงจำนวน หรือ Unlimited (ไม่มีปุ่มกด) */}
      <div className="flex items-center gap-3 ml-4">
        <span className={`text-sm font-medium ${item.isUnlimited ? 'text-gray-500' : 'text-gray-800'}`}>
           {item.isUnlimited ? "Unlimited" : item.count}
        </span>
      </div>
    </div>
  );

  return (
    <div className="w-full bg-white p-4 rounded-lg shadow-md">
      {/* Input/Output + Variables */}
      <div className="flex gap-16 overflow-x-auto mb-4">
        <div className="flex flex-col gap-2">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Input / Output</h3>
          <SymbolItemComponent item={symbols.input} />
          <SymbolItemComponent item={symbols.output} />
        </div>

        <div className="flex flex-col gap-2 ml-16">
          <h3 className="text-lg font-medium text-gray-700 mb-2">Variables</h3>
          <SymbolItemComponent item={symbols.declare} />
          <SymbolItemComponent item={symbols.assign} />
        </div>
      </div>

      {/* Control (เหลือแค่ If, While, For) */}
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-medium text-gray-700 mb-2">Control</h3>
        <SymbolItemComponent item={symbols.if} />
        <SymbolItemComponent item={symbols.while} />
        <SymbolItemComponent item={symbols.for} />
      </div>
    </div>
  );
};

export default SymbolSection;