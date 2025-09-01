"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Edge } from "@xyflow/react";

interface SymbolItem {
  label: string;
  imageSrc: string;
}

interface SymbolSectionProps {
  edge?: Edge;
  onAddNode?: (type: string, label: string) => void;
}


const SymbolSection: React.FC<SymbolSectionProps> = ({ onAddNode }) => {
  const [showInputModal, setShowInputModal] = useState(false);
  const [showOutputModal, setShowOutputModal] = useState(false);
  const [showDeclareModal, setShowDeclareModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false); // ✅ state สำหรับ Assign
  const [showIfModal, setShowIfModal] = useState(false);
  const [showWhileModal, setShowWhileModal] = useState(false);
  const [showForModal, setShowForModal] = useState(false);
  const [showDoModal, setShowDoModal] = useState(false);

    // เพิ่ม state สำหรับเก็บค่าที่กรอก
  const [inputValue, setInputValue] = useState("");
  const [outputValue, setOutputValue] = useState("");
  const [ifExpression, setIfExpression] = useState("");

  const symbols: Record<string, SymbolItem> = {
    input: { label: "Input", imageSrc: "/images/input.png" },
    output: { label: "Output", imageSrc: "/images/output.png" },
    declare: { label: "Declare", imageSrc: "/images/declare.png" },
    assign: { label: "Assign", imageSrc: "/images/assign.png" },
    if: { label: "IF", imageSrc: "/images/if.png" },
    call: { label: "Call", imageSrc: "/images/call.png" },
    while: { label: "While", imageSrc: "/images/while.png" },
    for: { label: "For", imageSrc: "/images/for.png" },
    do: { label: "Do", imageSrc: "/images/do.png" },
  };

  // Handlers
  const handleInputClick = () => setShowInputModal(true);
  const handleOutputClick = () => setShowOutputModal(true);
  const handleDeclareClick = () => setShowDeclareModal(true);
  const handleAssignClick = () => setShowAssignModal(true); // ✅ click Assign
  const handleIfClick = () => setShowIfModal(true);
  const handleWhileClick = () => setShowWhileModal(true);
  const handleForClick = () => setShowForModal(true);
  const handleDoClick = () => setShowDoModal(true);
  const handleCloseInputModal = () => setShowInputModal(false);
  const handleCloseOutputModal = () => setShowOutputModal(false);
  const handleCloseDeclareModal = () => setShowDeclareModal(false);
  const handleCloseAssignModal = () => setShowAssignModal(false); // ✅ close Assign
  const handleCloseIfModal = () => setShowIfModal(false);
  const handleCloseWhileModal = () => setShowWhileModal(false);
  const handleCloseForModal = () => setShowForModal(false);
  const handleCloseDoModal = () => setShowDoModal(false);

const handlers: Record<string, () => void> = {
  Input: handleInputClick,
  Output: handleOutputClick,
  Declare: handleDeclareClick,
  Assign: handleAssignClick,
  IF: handleIfClick,
  While: handleWhileClick,
  For: handleForClick,
  Do: handleDoClick,
};

const SymbolItemComponent: React.FC<{ item: SymbolItem }> = ({ item }) => (
  <div
    className="flex flex-col items-center gap-1 cursor-pointer"
    onClick={handlers[item.label]} // ใช้ mapping
  >
    <Image src={item.imageSrc} alt={item.label} width={100} height={60} />
    <span className="text-sm text-gray-700">{item.label}</span>
  </div>
);



  // --- Input Modal ---
if (showInputModal) {
  return (
    <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-4 border-1">
      <div className="text-xl font-semibold text-gray-800 mb-4">Input Properties</div>
      <input
        type="text"
        placeholder="Variable name"
        value={inputValue} // bind state
        onChange={(e) => setInputValue(e.target.value)} // update state
        className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
      />
      <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
        <button
          onClick={() => {
            handleCloseInputModal();
            setInputValue(""); // reset
          }}
          className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (inputValue.trim() !== "") {
              onAddNode?.("input", inputValue); // ส่ง label ที่ผู้ใช้กรอก
              setInputValue(""); // reset
              handleCloseInputModal();
            }
          }}
          className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
        >
          Ok
        </button>
      </div>
    </div>
  );
}


  // --- Output Modal ---
if (showOutputModal) {
  return (
    <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
      <div className="text-xl font-semibold text-gray-800 mb-4 ml-2 mt-1">
        Output Properties
      </div>

      <div className="text-gray-700 mb-2 ml-4">Output</div>

      <input
        type="text"
        placeholder="Variable or expression"
        value={outputValue} // bind state
        onChange={(e) => setOutputValue(e.target.value)} // update state
        className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
      />

      <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
        <button
          onClick={() => {
            handleCloseOutputModal();
            setOutputValue(""); // reset
          }}
          className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (outputValue.trim() !== "") {
              onAddNode?.("output", outputValue); // ส่ง label ที่ผู้ใช้กรอก
              setOutputValue(""); // reset
              handleCloseOutputModal();
            }
          }}
          className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
        >
          Ok
        </button>
      </div>

      <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
        <img src="/images/Rectangle.png" alt="Icon" className="w-50 h-7" />
        <span className="text-gray-600 text-sm">
          An Output Statement evaluates an expression and then displays the
          result to the screen.
        </span>
      </div>
    </div>
  );
}

  // --- Declare Modal ---
  if (showDeclareModal) {
    return (
      <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
        <div className="text-xl font-semibold text-gray-800 mb-4 ml-2 mt-1">
          Declare Properties
        </div>

        <div className="text-gray-700 mb-2 ml-4">Variable Name</div>

        <input
          type="text"
          placeholder=""
          className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        />

        <div className="text-gray-700 mb-2 ml-4">Data Type</div>

        <div className="grid grid-cols-2 gap-2 ml-6 mb-4">
          <label className="flex items-center gap-1 text-sm text-gray-700">
            <input type="radio" name="dataType" value="integer" className="w-4 h-4" /> Integer
          </label>
          <label className="flex items-center gap-1 text-sm text-gray-700">
            <input type="radio" name="dataType" value="real" className="w-4 h-4" /> Real
          </label>
          <label className="flex items-center gap-1 text-sm text-gray-700">
            <input type="radio" name="dataType" value="string" className="w-4 h-4" /> String
          </label>
          <label className="flex items-center gap-1 text-sm text-gray-700">
            <input type="radio" name="dataType" value="boolean" className="w-4 h-4" /> Boolean
          </label>
        </div>

        <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
          <button
            onClick={handleCloseDeclareModal}
            className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              alert("Declare Saved!");
              handleCloseDeclareModal();
            }}
            className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
          >
            Ok
          </button>
        </div>

        <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
          <img src="/images/shape_Declare.png" alt="Icon" className="w-50 h-7" />
          <span className="text-gray-600 text-sm">
            A Declare Statement is used to create variables and arrays. These are used to store data while the program runs.
          </span>
        </div>
      </div>
    );
  }

  // --- Assign Modal ---
  if (showAssignModal) {
    return (
      <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
        <div className="text-xl font-semibold text-gray-800 mb-4 ml-2 mt-1">
          Assign Properties
        </div>

        <div className="text-gray-700 mb-2 ml-4">Varibles</div>

        <input
          type="text"
          placeholder=""
          className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        />


        <div className="text-gray-700 mb-2 ml-4">Expression</div>

        <input
          type="text"
          placeholder=""
          className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        />

        <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
          <button
            onClick={handleCloseAssignModal}
            className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              alert("Assign Saved!");
              handleCloseAssignModal();
            }}
            className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
          >
            Ok
          </button>
        </div>

        <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
          <img src="/images/square.png" alt="Icon" className="w-50 h-7" />
          <span className="text-gray-600 text-sm">
            An Assignment Statement calculates an expression and then stores the result in a variable.
          </span>
        </div>
      </div>
    );
  }

  // --- IF Modal ---
if (showIfModal) {
  return (
    <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
      <div className="text-xl font-semibold text-gray-800 mb-4 ml-2 mt-1">
        If Properties
      </div>

      <div className="text-gray-700 mb-2 ml-4">Enter a conditional expression below</div>

      <input
        type="text"
        placeholder="Condition"
        value={ifExpression}
        onChange={(e) => setIfExpression(e.target.value)}
        className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
      />

      <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
        <button
          onClick={handleCloseIfModal}
          className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (ifExpression.trim() !== "") {
              onAddNode?.("if", ifExpression); // ส่งค่าไปสร้าง IF Node
            }
            handleCloseIfModal();
            setIfExpression("");
          }}
          className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
        >
          Ok
        </button>
      </div>

      <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
        <img src="/images/shape_if.png" alt="Icon" className="w-50 h-10" />
        <span className="text-gray-600 text-sm">
          An IF Statement checks a Boolean expression then executes a true or false branch based on the result.
        </span>
      </div>
    </div>
  );
}

// --- While Modal ---
if (showWhileModal) {
  return (
    <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
      <div className="text-xl font-semibold text-gray-800 mb-4 ml-2 mt-1">
        While Properties
      </div>

      <div className="text-gray-700 mb-2 ml-4">Enter a loop condition below</div>

      <input
        type="text"
        placeholder=""
        className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
      />

      <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
        <button
          onClick={handleCloseWhileModal}
          className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            alert("WHILE Saved!");
            handleCloseWhileModal();
          }}
          className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
        >
          Ok
        </button>
      </div>

      <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
        <img src="/images/shape_while.png" alt="Icon" className="w-50 h-10" />
        <span className="text-gray-600 text-sm">
          A WHILE Statement repeatedly executes a block of code as long as the condition evaluates to true.
        </span>
      </div>
    </div>
  );
}

// --- For Modal ---
if (showForModal) {
  return (
    <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
      <div className="text-xl font-semibold text-gray-800 mb-4 ml-2 mt-1">
        For Properties
      </div>

        <div className="grid grid-cols-2 gap-4 ml-6 mb-4">
          {/* ช่องที่ 1 */}
          <div className="flex flex-col mr-4">
            <label className="text-gray-700 text-sm mb-1">Variables</label>
            <input
              type="text"
              placeholder=""
              className="w-full border border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ช่องที่ 2 */}
          <div className="flex flex-col mr-3">
            <label className="text-gray-700 text-sm mb-1">Step By</label>
            <input
              type="text"
              placeholder=""
              className="w-full border border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ช่องที่ 3 */}
          <div className="flex flex-col mr-4">
            <label className="text-gray-700 text-sm mb-1">Start</label>
            <input
              type="text"
              placeholder=""
              className="w-full border border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* ช่องที่ 4 */}
          <div className="flex flex-col mr-3">
            <label className="text-gray-700 text-sm mb-1">End</label>
            <input
              type="text"
              placeholder=""
              className="w-full border border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="text-gray-700 mb-2 ml-6 text-sm">Direction</div>
          <label className="flex items-center gap-1 text-sm text-gray-700 ml-8">
            <input type="radio" name="dataType" value="integer" className="w-4 h-4" /> Increasing
          </label>
          <label className="flex items-center gap-1 text-sm text-gray-700 ml-8 mt-3">
            <input type="radio" name="dataType" value="real" className="w-4 h-4" /> decreasing
          </label>


      <div className="flex justify-end gap-3 mt-3 mr-4 text-xs">
        <button
          onClick={handleCloseForModal}
          className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            alert("FOR Saved!");
            handleCloseForModal();
          }}
          className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
        >
          Ok
        </button>
      </div>

      <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
        <img src="/images/shape_while.png" alt="Icon" className="w-50 h-10" />
        <span className="text-gray-600 text-sm">
          A For Loop increments or decrements a variable through a range of values. This is a common and useful replacement for a While Loop.
        </span>
      </div>
    </div>
  );
}


// --- Do Modal ---
if (showDoModal) {
  return (
    <div className="w-[440px] mx-auto mt-10 bg-white rounded-lg shadow-lg p-1 border-1">
      <div className="text-xl font-semibold text-gray-800 mb-4 ml-2 mt-1">
        Do Properties
      </div>

      <div className="text-gray-700 mb-2 ml-4">Enter a conditional or loop expression below</div>

      <input
        type="text"
        placeholder=""
        className="w-96 border ml-6 border-gray-400 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
      />

      <div className="flex justify-end gap-3 mt-3 mr-5 text-xs">
        <button
          onClick={handleCloseDoModal}
          className="w-24 px-5 py-2 rounded-full border border-gray-400 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            alert("DO Saved!");
            handleCloseDoModal();
          }}
          className="w-24 px-5 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
        >
          Ok
        </button>
      </div>

      <div className="bg-[#E9E5FF] rounded-b-lg mt-6 p-3 flex items-center gap-2">
        <img src="/images/shape_while.png" alt="Icon" className="w-50 h-10" />
        <span className="text-gray-600 text-sm">
          The Do Loop is similar to a While Loop except that the block of statements is executed at least once before the expression is checked.
        </span>
      </div>
    </div>
  );
}


  // --- Symbol Section ---
  return (
    <div className="w-full bg-white p-4 flex flex-col gap-4 rounded-lg shadow-lg border-1">
      {/* Input / Output */}
      <div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Input / Output</h3>
        <div className="flex gap-4">
          <SymbolItemComponent item={symbols.input} />
          <SymbolItemComponent item={symbols.output} />
        </div>
      </div>

      {/* Variables */}
      <div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Variables</h3>
        <div className="flex gap-4">
          <SymbolItemComponent item={symbols.declare} />
          <SymbolItemComponent item={symbols.assign} />
        </div>
      </div>

      {/* Control */}
      <div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Control</h3>
        <div className="flex gap-4">
          <SymbolItemComponent item={symbols.if} />
        </div>
      </div>

      {/* Looping */}
      <div>
        <h3 className="text-lg font-bold text-gray-700 mb-2">Looping</h3>
        <div className="flex gap-4">
          <SymbolItemComponent item={symbols.while} />
          <SymbolItemComponent item={symbols.for} />
          <SymbolItemComponent item={symbols.do} />
        </div>
      </div>
    </div>
  );
};

export default SymbolSection;
