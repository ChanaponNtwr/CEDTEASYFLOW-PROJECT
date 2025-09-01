"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import Link from "next/link";

// ประเภทข้อมูลสำหรับ Testcase
interface TestCase {
  input: string;
  output: string;
  hiddenInput: string;
  hiddenOutput: string;
}

function Editlab() {
  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "", output: "", hiddenInput: "", hiddenOutput: "" },
  ]);

  // เพิ่ม Testcase
  const addTestCase = () => {
    setTestCases([
      ...testCases,
      { input: "", output: "", hiddenInput: "", hiddenOutput: "" },
    ]);
  };

  // ลบ Testcase
  const removeTestCase = (index: number) => {
    if (testCases.length === 1) return; // ป้องกันไม่ให้ลบจนไม่เหลือเลย
    const updated = [...testCases];
    updated.splice(index, 1);
    setTestCases(updated);
  };

  // อัปเดตข้อมูลใน Testcase
  const handleTestCaseChange = (
    index: number,
    field: keyof TestCase,
    value: string
  ) => {
    const updated = [...testCases];
    updated[index][field] = value;
    setTestCases(updated);
  };

  const handleSymbolChange = (symbols: {
    input: number;
    output: number;
    declare: number;
    assign: number;
    if: number;
    call: number;
  }) => {
    console.log("Symbol counts updated:", symbols);
  };

  const handleCancel = () => {
    console.log("Cancel button clicked");
  };

  const handleSave = () => {
    console.log("Save button clicked", { testCases });
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <div className="pl-60">
        <Navbar />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 flex flex-col p-6 md:p-10">
            {/* ปุ่ม Cancel / Save */}
            <div className="flex justify-end space-x-4 mb-6">
              <Link
                href="/mylab"
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Cancel
              </Link>
              <Link
                href="/mylab"
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

            {/* ชื่อหัวข้อ */}
            <h2 className="text-3xl md:text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-6">
              Edit Lab
            </h2>

            <div className="flex flex-col md:flex-row gap-6">
              {/* ส่วนซ้าย */}
              <div className="flex-1 space-y-6">
                {/* Name และ Score */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <input
                      type="text"
                      placeholder="Name..."
                      className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="w-full md:w-1/4">
                    <label className="block text-sm font-medium text-gray-700">
                      Score
                    </label>
                    <input
                      type="text"
                      placeholder="Score..."
                      className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Problem Solving */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Problem solving
                  </label>
                  <textarea
                    placeholder="Detail..."
                    className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 h-32"
                  />
                </div>

                {/* Testcases */}
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-4 ">
                    Create Testcase
                  </h3>

                  {testCases.map((testCase, index) => (
                    <div
                      key={index}
                      className="relative border rounded-lg p-4 mb-4 shadow-sm bg-gray-50"
                    >
                      {/* ปุ่มลบ */}
                      <button
                        onClick={() => removeTestCase(index)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                        title="Remove this Testcase"
                      >
                        ✕
                      </button>

                      <div className="mb-2 text-gray-700 font-semibold">
                        Testcase {index + 1}
                      </div>

                      {/* Public input/output */}
                      <div className="grid grid-cols-12 gap-4 mb-3 ml-5">
                        <div className="col-span-6">
                          <label className="block text-sm text-gray-700 mb-1">
                            Input
                          </label>
                          <input
                            type="text"
                            value={testCase.input}
                            onChange={(e) =>
                              handleTestCaseChange(
                                index,
                                "input",
                                e.target.value
                              )
                            }
                            placeholder="Public Input"
                            className="w-full bg-white p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div className="col-span-6">
                          <label className="block text-sm text-gray-700 mb-1">
                            Output
                          </label>
                          <input
                            type="text"
                            value={testCase.output}
                            onChange={(e) =>
                              handleTestCaseChange(
                                index,
                                "output",
                                e.target.value
                              )
                            }
                            placeholder="Public Output"
                            className="w-full bg-white p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Hidden input/output */}
                      <div className="grid grid-cols-12 gap-4 ml-5">
                        <div className="col-span-6">
                          <label className="block text-sm text-gray-700 mb-1">
                            Hidden Input
                          </label>
                          <input
                            type="text"
                            value={testCase.hiddenInput}
                            onChange={(e) =>
                              handleTestCaseChange(
                                index,
                                "hiddenInput",
                                e.target.value
                              )
                            }
                            placeholder="Hidden Input"
                            className="w-full bg-white p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div className="col-span-6">
                          <label className="block text-sm text-gray-700 mb-1">
                            Hidden Output
                          </label>
                          <input
                            type="text"
                            value={testCase.hiddenOutput}
                            onChange={(e) =>
                              handleTestCaseChange(
                                index,
                                "hiddenOutput",
                                e.target.value
                              )
                            }
                            placeholder="Hidden Output"
                            className="w-full bg-white p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* ปุ่มเพิ่ม */}
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={addTestCase}
                      className="text-sm text-black hover:underline"
                    >
                      + Add to Your Testcase
                    </button>
                  </div>
                </div>
              </div>

              {/* ส่วนขวา */}
              <SymbolSection onChange={handleSymbolChange} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Editlab;
