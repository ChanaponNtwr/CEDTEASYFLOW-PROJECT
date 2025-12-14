"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import Link from "next/link";
import { apiGetTestcases, apiCreateTestcase, apiUpdateTestcase, apiDeleteTestcase } from "@/app/service/FlowchartService";

// ประเภทข้อมูลสำหรับ Testcase
interface TestCase {
  id?: string | number;
  input: string;
  output: string;
  hiddenInput: string;
  hiddenOutput: string;
  score: string;
}

function Editlab() {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  const LAB_ID = 2; // Fixed as requested

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await apiGetTestcases(LAB_ID);
        // data could be array or { data: [] }
        const list = Array.isArray(data) ? data : (data?.data ?? data?.testcases ?? []);

        const parseVal = (val: any): any => {
          if (typeof val === "string") {
            const trimmed = val.trim();
            try {
              // Try parsing as JSON
              const parsed = JSON.parse(val);
              // Recursively parse the result
              return parseVal(parsed);
            } catch {
              // If JSON parse fails but it looks like an array (starts with [), try manual parsing
              if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                // Strip brackets
                const content = trimmed.slice(1, -1);
                // Split by comma (rough split, assumes no commas in values)
                // And clean up quotes
                const items = content.split(",").map(part => {
                  const p = part.trim();
                  // Remove surrounding quotes if present
                  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
                    return p.slice(1, -1);
                  }
                  return p;
                });
                return parseVal(items);
              }
              return val;
            }
          }
          if (Array.isArray(val)) {
            return val.map(parseVal);
          }
          return val;
        };

        const flattenDeep = (arr: any[]): any[] => {
          return arr.reduce((acc, val) => Array.isArray(val) ? acc.concat(flattenDeep(val)) : acc.concat(val), []);
        };

        const mapped = list.map((tc: any) => {
          // Parse and then flatten to ensure we just have a list of values
          const rawInput = parseVal(tc.inputVal);
          const rawOutput = parseVal(tc.outputVal);
          const rawHiddenInput = parseVal(tc.inHiddenVal);
          const rawHiddenOutput = parseVal(tc.outHiddenVal);

          const format = (v: any) => {
            if (Array.isArray(v)) {
              return flattenDeep(v).join(",");
            }
            return String(v ?? "");
          };

          return {
            id: tc.testcaseId ?? tc.id,
            input: format(rawInput),
            output: format(rawOutput),
            hiddenInput: format(rawHiddenInput),
            hiddenOutput: format(rawHiddenOutput),
            score: String(tc.score ?? 0)
          };
        });

        setTestCases(mapped.length > 0 ? mapped : [{ input: "", output: "", hiddenInput: "", hiddenOutput: "", score: "" }]);
      } catch (err) {
        console.error("Failed to load testcases", err);
      }
    };
    loadData();
  }, []);

  // เพิ่ม Testcase
  const addTestCase = () => {
    setTestCases([
      ...testCases,
      { input: "", output: "", hiddenInput: "", hiddenOutput: "", score: "" },
    ]);
  };

  // ลบ Testcase
  // Trigger delete confirmation
  const requestDeleteTestcase = (index: number) => {
    setDeleteTargetIndex(index);
  };

  // Perform actual delete
  const confirmDelete = async () => {
    if (deleteTargetIndex === null) return;

    const index = deleteTargetIndex;
    const target = testCases[index];

    if (target.id) {
      try {
        await apiDeleteTestcase(target.id);
      } catch (e) {
        console.error("Delete failed", e);
        alert("Failed to delete testcase");
        setDeleteTargetIndex(null);
        return;
      }
    }

    const updated = [...testCases];
    updated.splice(index, 1);
    setTestCases(updated);
    setDeleteTargetIndex(null);
  };

  const cancelDelete = () => {
    setDeleteTargetIndex(null);
  }

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

  const handleSave = async () => {
    console.log("Save button clicked", { testCases });
    try {
      for (const tc of testCases) {
        // Convert comma separated string to array
        const toArray = (str: string) => str.split(",").map(s => s.trim()).filter(s => s !== "");

        const payload = {
          inputVal: toArray(tc.input),
          outputVal: toArray(tc.output),
          inHiddenVal: toArray(tc.hiddenInput),
          outHiddenVal: toArray(tc.hiddenOutput),
          score: Number(tc.score) || 0
        };

        if (tc.id) {
          await apiUpdateTestcase(tc.id, payload);
        } else {
          await apiCreateTestcase(LAB_ID, payload);
        }
      }
      alert("Saved successfully!");
      // reload to get IDs
      const data = await apiGetTestcases(LAB_ID);
      const list = Array.isArray(data) ? data : (data?.data ?? data?.testcases ?? []);
      const mapped = list.map((tc: any) => ({
        id: tc.testcaseId ?? tc.id,
        input: Array.isArray(tc.inputVal) ? tc.inputVal.join(",") : (tc.inputVal ?? ""),
        output: Array.isArray(tc.outputVal) ? tc.outputVal.join(",") : (tc.outputVal ?? ""),
        hiddenInput: Array.isArray(tc.inHiddenVal) ? tc.inHiddenVal.join(",") : (tc.inHiddenVal ?? ""),
        hiddenOutput: Array.isArray(tc.outHiddenVal) ? tc.outHiddenVal.join(",") : (tc.outHiddenVal ?? ""),
        score: String(tc.score ?? 0)
      }));
      setTestCases(mapped);
    } catch (err) {
      console.error("Save failed", err);
      alert("Save failed, check console");
    }
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
                    <label className="block text-sm font-medium text-gray-700">Dateline</label>
                    <input
                      type="date"
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
                        onClick={() => requestDeleteTestcase(index)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                        title="Remove this Testcase"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
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

                      <div className="grid grid-cols-12 gap-4 mb-3 ml-5">
                        <div className="col-span-6">
                          <label className="block text-sm text-gray-700 mb-1">
                            Score
                          </label>
                          <input
                            type="text"
                            value={testCase.score}
                            onChange={(e) =>
                              handleTestCaseChange(
                                index,
                                "score",
                                e.target.value
                              )
                            }
                            placeholder="Score"
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

      {/* Delete Confirmation Modal */}
      {deleteTargetIndex !== null && (
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-md flex items-center justify-center z-[1000] animate-fadeIn">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl">
            {/* Header Handle */}
            <div className="flex justify-center mb-4">
              <div
                onClick={cancelDelete}
                className="w-28 h-1 bg-[#dbdbdb] rounded-lg cursor-pointer hover:bg-gray-400 transition-colors"
                title="Close"
              />
            </div>

            <div className="mb-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-3xl font-medium text-gray-900">Delete Testcase</h3>
              <p className="text-gray-500 mt-2">
                Are you sure you want to delete <span className="font-semibold text-gray-700">Testcase {deleteTargetIndex + 1}</span>?
              </p>
            </div>

            <div className="flex justify-center gap-4 mt-6">
              <button
                onClick={cancelDelete}
                className="px-8 py-2.5 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-8 py-2.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all duration-200 font-medium shadow-lg shadow-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Editlab;
