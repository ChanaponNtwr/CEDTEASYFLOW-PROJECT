"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";

interface SymbolItem {
  label: string;
  bgColor: string;
  textColor: string;
  count: number;
  isUnlimited: boolean;
  imageSrc: string;
}

interface SymbolSectionProps {
  // เพิ่ม prop นี้เพื่อรับค่าเดิมจาก Database
  initialValues?: {
    input?: number;
    output?: number;
    declare?: number;
    assign?: number;
    if?: number;
    while?: number;
    for?: number;
  };
  onChange?: (symbols: {
    input: number;
    output: number;
    declare: number;
    assign: number;
    if: number;
    while: number;
    for: number;
  }) => void;
}

const SymbolSection: React.FC<SymbolSectionProps> = ({ onChange, initialValues }) => {
  const [symbols, setSymbols] = useState<{
    input: SymbolItem;
    output: SymbolItem;
    declare: SymbolItem;
    assign: SymbolItem;
    if: SymbolItem;
    while: SymbolItem;
    for: SymbolItem;
  }>({
    input: {
      label: "Input",
      bgColor: "bg-blue-200",
      textColor: "text-blue-800",
      count: 0,
      isUnlimited: false,
      imageSrc: "/images/input.png",
    },
    output: {
      label: "Output",
      bgColor: "bg-green-200",
      textColor: "text-green-800",
      count: 0,
      isUnlimited: false,
      imageSrc: "/images/output.png",
    },
    declare: {
      label: "Declare",
      bgColor: "bg-yellow-200",
      textColor: "text-yellow-800",
      count: 0,
      isUnlimited: false,
      imageSrc: "/images/declare.png",
    },
    assign: {
      label: "Assign",
      bgColor: "bg-yellow-200",
      textColor: "text-yellow-800",
      count: 0,
      isUnlimited: false,
      imageSrc: "/images/assign.png",
    },
    if: {
      label: "IF",
      bgColor: "bg-pink-200",
      textColor: "text-pink-800",
      count: 0,
      isUnlimited: false,
      imageSrc: "/images/if.png",
    },
    while: {
      label: "While",
      bgColor: "bg-indigo-200",
      textColor: "text-indigo-800",
      count: 0,
      isUnlimited: false,
      imageSrc: "/images/while.png",
    },
    for: {
      label: "For",
      bgColor: "bg-teal-200",
      textColor: "text-teal-800",
      count: 0,
      isUnlimited: false,
      imageSrc: "/images/for.png",
    },
  });

  // --- เพิ่ม useEffect เพื่อ Set ค่าเริ่มต้นเมื่อ initialValues เปลี่ยนแปลง ---
  useEffect(() => {
    if (initialValues) {
      const mapVal = (val?: number) => {
        // ถ้าค่าเป็น -1 หรือไม่มีค่า ให้ถือว่าเป็น Unlimited
        if (val === -1) return { count: 0, isUnlimited: true };
        // ถ้ามีค่าปกติ
        return { count: val ?? 0, isUnlimited: false };
      };

      setSymbols((prev) => ({
        ...prev,
        input: { ...prev.input, ...mapVal(initialValues.input) },
        output: { ...prev.output, ...mapVal(initialValues.output) },
        declare: { ...prev.declare, ...mapVal(initialValues.declare) },
        assign: { ...prev.assign, ...mapVal(initialValues.assign) },
        if: { ...prev.if, ...mapVal(initialValues.if) },
        while: { ...prev.while, ...mapVal(initialValues.while) },
        for: { ...prev.for, ...mapVal(initialValues.for) },
      }));
    }
  }, [initialValues]);

  // ฟังก์ชันช่วยส่งค่ากลับ Parent
  const emitChange = (s: typeof symbols) => {
    if (onChange) {
      onChange({
        input: s.input.isUnlimited ? -1 : s.input.count,
        output: s.output.isUnlimited ? -1 : s.output.count,
        declare: s.declare.isUnlimited ? -1 : s.declare.count,
        assign: s.assign.isUnlimited ? -1 : s.assign.count,
        if: s.if.isUnlimited ? -1 : s.if.count,
        while: s.while.isUnlimited ? -1 : s.while.count,
        for: s.for.isUnlimited ? -1 : s.for.count,
      });
    }
  };

  const handleCountChange = (
    key: keyof typeof symbols,
    increment: boolean
  ) => {
    setSymbols((prev) => {
      if (prev[key].isUnlimited) return prev;
      const next = { ...prev };
      next[key] = {
        ...next[key],
        count: increment
          ? next[key].count + 1
          : Math.max(0, next[key].count - 1),
      };
      
      emitChange(next); 
      return next;
    });
  };

  const handleUnlimitedChange = (
    key: keyof typeof symbols,
    checked: boolean
  ) => {
    setSymbols((prev) => {
      const next = { ...prev };
      next[key] = { ...next[key], isUnlimited: checked };
      emitChange(next); 
      return next;
    });
  };

  const SymbolItemComponent: React.FC<{
    item: SymbolItem;
    symbolKey: keyof typeof symbols;
  }> = ({ item, symbolKey }) => (
    <div className="flex items-center justify-between">
      <Image
        src={item.imageSrc}
        alt={item.label}
        width={120}
        height={60}
        className={`${item.bgColor} ${item.textColor}`}
      />

      <div className="flex items-center gap-4">
        <button
          type="button" 
          className={`w-8 h-8 rounded ${item.isUnlimited ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-200"}`}
          onClick={() => handleCountChange(symbolKey, false)}
          disabled={item.isUnlimited}
        >
          -
        </button>

        <span className="w-10 text-center font-medium">
            {item.isUnlimited ? "∞" : item.count}
        </span>

        <button
          type="button" 
          className={`w-8 h-8 rounded ${item.isUnlimited ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-gray-200"}`}
          onClick={() => handleCountChange(symbolKey, true)}
          disabled={item.isUnlimited}
        >
          +
        </button>

        <input
          type="checkbox"
          checked={item.isUnlimited}
          onChange={(e) =>
            handleUnlimitedChange(symbolKey, e.target.checked)
          }
          className="cursor-pointer"
        />
        <span 
            className="text-sm text-gray-600 cursor-pointer"
            onClick={() => handleUnlimitedChange(symbolKey, !item.isUnlimited)}
        >
            Unlimited
        </span>
      </div>
    </div>
  );

  return (
    <div className="w-full md:w-1/3 bg-white p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-medium mb-4">SYMBOL</h3>

      <div className="space-y-4">
        <SymbolItemComponent item={symbols.input} symbolKey="input" />
        <SymbolItemComponent item={symbols.output} symbolKey="output" />
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-medium mb-2">VARIABLES</h4>
        <SymbolItemComponent item={symbols.declare} symbolKey="declare" />
        <SymbolItemComponent item={symbols.assign} symbolKey="assign" />
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-medium mb-2">CONTROL</h4>
        <SymbolItemComponent item={symbols.if} symbolKey="if" />
        <SymbolItemComponent item={symbols.while} symbolKey="while" />
        <SymbolItemComponent item={symbols.for} symbolKey="for" />
      </div>
    </div>
  );
};

export default SymbolSection;