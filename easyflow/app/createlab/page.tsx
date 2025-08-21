"use client"; // ระบุว่าเป็น client component สำหรับ Next.js App Router

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

// กำหนดประเภทสำหรับ test case
interface TestCase {
  input: string;
  output: string;
}

function Createlab() {
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

  // Handler สำหรับปุ่ม Cancel และ Create
  const handleCancel = () => {
    console.log("Cancel button clicked");
    // เพิ่ม logic เช่น redirect หรือ reset form
  };

  const handleCreate = () => {
    console.log("Create button clicked", { testCases });
    // เพิ่ม logic เช่น ส่งข้อมูลไป API
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <Navbar />
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col p-6 md:p-10"> {/* ปรับ padding สำหรับ responsive */}
          {/* Buttons (Cancel and Create) */}
          <div className="flex justify-end space-x-4 mb-6">
            <button
              onClick={handleCancel}
              className="bg-red-500 text-white px-4 py-2 rounded-full flex items-center hover:bg-red-600"
              aria-label="Cancel creating lab"
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
            </button>
            <button
              onClick={handleCreate}
              className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center hover:bg-blue-700"
              aria-label="Create lab"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Create
            </button>
          </div>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-6">
            Create Lab
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
            <div className="w-full md:w-1/3 bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-lg font-medium text-gray-700 mb-4">SYMBOL</h3>

              {/* Input/Output */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-200 text-blue-800 px-3 py-1 rounded-md">Input</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-gray-500" aria-label="Decrease input count">-</button>
                    <span>0</span>
                    <button className="text-gray-500" aria-label="Increase input count">+</button>
                    <input type="checkbox" className="ml-2" defaultChecked />
                    <label className="text-sm text-gray-600">Unlimited</label>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-green-200 text-green-800 px-3 py-1 rounded-md">Output</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="text-gray-500" aria-label="Decrease output count">-</button>
                    <span>0</span>
                    <button className="text-gray-500" aria-label="Increase output count">+</button>
                    <input type="checkbox" className="ml-2" defaultChecked />
                    <label className="text-sm text-gray-600">Unlimited</label>
                  </div>
                </div>
              </div>

              {/* Variables */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">VARIABLES</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-md">Declare</div>
                    <div className="flex items-center gap-2">
                      <button className="text-gray-500" aria-label="Decrease declare count">-</button>
                      <span>0</span>
                      <button className="text-gray-500" aria-label="Increase declare count">+</button>
                      <input type="checkbox" className="ml-2" defaultChecked />
                      <label className="text-sm text-gray-600">Unlimited</label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-md">Assign</div>
                    <div className="flex items-center gap-2">
                      <button className="text-gray-500" aria-label="Decrease assign count">-</button>
                      <span>0</span>
                      <button className="text-gray-500" aria-label="Increase assign count">+</button>
                      <input type="checkbox" className="ml-2" defaultChecked />
                      <label className="text-sm text-gray-600">Unlimited</label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Control */}
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">CONTROL</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="bg-pink-200 text-pink-800 px-3 py-1 rounded-md">IF</div>
                    <div className="flex items-center gap-2">
                      <button className="text-gray-500" aria-label="Decrease IF count">-</button>
                      <span>5</span>
                      <button className="text-gray-500" aria-label="Increase IF count">+</button>
                      <input type="checkbox" className="ml-2" />
                      <label className="text-sm text-gray-600">Unlimited</label>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="bg-purple-200 text-purple-800 px-3 py-1 rounded-md">Call</div>
                    <div className="flex items-center gap-2">
                      <button className="text-gray-500" aria-label="Decrease call count">-</button>
                      <span>2</span>
                      <button className="text-gray-500" aria-label="Increase call count">+</button>
                      <input type="checkbox" className="ml-2" />
                      <label className="text-sm text-gray-600">Unlimited</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Createlab;
