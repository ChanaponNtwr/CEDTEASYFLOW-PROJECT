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

const SymbolSection: React.FC<SymbolSectionProps> = ({ onChange }) => {
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

  // ส่งค่าเริ่มต้นให้ parent ตอน mount
  useEffect(() => {
    onChange?.({
      input: symbols.input.count,
      output: symbols.output.count,
      declare: symbols.declare.count,
      assign: symbols.assign.count,
      if: symbols.if.count,
      while: symbols.while.count,
      for: symbols.for.count,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emitChange = (s: typeof symbols) => {
    onChange?.({
      input: s.input.count,
      output: s.output.count,
      declare: s.declare.count,
      assign: s.assign.count,
      if: s.if.count,
      while: s.while.count,
      for: s.for.count,
    });
  };

  const handleCountChange = (
    key: keyof typeof symbols,
    increment: boolean
  ) => {
    setSymbols((prev) => {
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
          className="w-8 h-8 bg-gray-200 rounded"
          onClick={() => handleCountChange(symbolKey, false)}
        >
          -
        </button>

        <span className="w-10 text-center">{item.count}</span>

        <button
          className="w-8 h-8 bg-gray-200 rounded"
          onClick={() => handleCountChange(symbolKey, true)}
        >
          +
        </button>

        <input
          type="checkbox"
          checked={item.isUnlimited}
          onChange={(e) =>
            handleUnlimitedChange(symbolKey, e.target.checked)
          }
        />
        <span className="text-sm text-gray-600">Unlimited</span>
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
