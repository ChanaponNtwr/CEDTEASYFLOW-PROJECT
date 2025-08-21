"use client"; // ระบุว่าเป็น client component สำหรับ Next.js App Router

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import Link from "next/link";
// กำหนดประเภทสำหรับ test case
interface TestCase {
  input: string;
  output: string;
}

function Editlab() {
  // State สำหรับ test cases
  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "", output: "" },
    { input: "", output: "" },
  ]);

  // Handler สำหรับเพิ่ม test case
  const addTestCase = () => {
    setTestCases([...testCases, { input: "", output: "" }]);
  };

  // Handler สำหรับการเปลี่ยนแปลง input/output ใน test case
  const handleTestCaseChange = (index: number, field: "input" | "output", value: string) => {
    const updatedTestCases = [...testCases];
    updatedTestCases[index][field] = value;
    setTestCases(updatedTestCases);
  };

  // Handler สำหรับการเปลี่ยนแปลงใน SymbolSection
  const handleSymbolChange = (symbols: {
    input: number;
    output: number;
    declare: number;
    assign: number;
    if: number;
    call: number;
  }) => {
    console.log("Symbol counts updated:", symbols);
    // เพิ่ม logic เช่น อัพเดต state หรือส่งข้อมูลไป API
  };

  // Handler สำหรับปุ่ม Cancel และ Save
  const handleCancel = () => {
    console.log("Cancel button clicked");
    // เพิ่ม logic เช่น redirect หรือ reset form
  };

  const handleSave = () => {
    console.log("Save button clicked", { testCases });
    // เพิ่ม logic เช่น ส่งข้อมูลไป API
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <Navbar />
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col p-6 md:p-10">
          {/* Buttons (Cancel and Save) */}
          <div className="flex justify-end space-x-4 mb-6">
            <Link href="/mylab"
              onClick={handleCancel}
              className="bg-[#D21F3C] text-white px-4 py-2 rounded-full flex items-center hover:bg-[#B81C35]"
              aria-label="Cancel editing lab"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </Link>
            <Link href="/mylab"
              onClick={handleSave}
              className="bg-[#2E8B57] text-white px-4 py-2 rounded-full flex items-center hover:bg-[#267347]"
              aria-label="Save lab changes"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Save
            </Link>
          </div>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-6">
            Edit Lab
          </h2>

          {/* Main Content */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left Section: Name, Score, Problem Solving, Test Cases */}
            <div className="flex-1 space-y-6">
              {/* Name and Score */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    placeholder="Name..."
                    className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="w-full md:w-1/4">
                  <label className="block text-sm font-medium text-gray-700">Score</label>
                  <input
                    type="text"
                    placeholder="Score..."
                    className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Problem Solving */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Problem solving</label>
                <textarea
                  placeholder="Detail..."
                  className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 h-32"
                />
              </div>

              {/* Test Cases */}
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">Create Testcase</h3>
                <div className="flex flex-col md:flex-row gap-4 md:gap-8 mb-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">INPUT</label>
                    {testCases.map((testCase, index) => (
                      <div key={`input-${index}`} className="mb-2 p-2">
                        <input
                          type="text"
                          value={testCase.input}
                          onChange={(e) => handleTestCaseChange(index, "input", e.target.value)}
                          className="bg-white block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Input"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">OUTPUT</label>
                    {testCases.map((testCase, index) => (
                      <div key={`output-${index}`} className="mb-2 p-2">
                        <input
                          type="text"
                          value={testCase.output}
                          onChange={(e) => handleTestCaseChange(index, "output", e.target.value)}
                          className="bg-white block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Output"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={addTestCase}
                  className="text-blue-600 hover:underline"
                  aria-label="Add new test case"
                >
                  + Add to Your Testcase
                </button>
              </div>
            </div>

            {/* Right Section: Symbol Selection */}
            <SymbolSection onChange={handleSymbolChange} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Editlab;