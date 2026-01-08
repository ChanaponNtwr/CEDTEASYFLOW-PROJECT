"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  apiGetLab,
  apiGetTestcases,
  apiCreateTestcase,
  apiUpdateTestcase,
  apiDeleteTestcase,
  apiUpdateLab,
} from "@/app/service/FlowchartService";

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const labIdParam = searchParams?.get("labId");
  const LAB_ID = labIdParam ? Number(labIdParam) : null; // now derived from query string

  const [labName, setLabName] = useState<string>("");
  const [dateline, setDateline] = useState<string>("");
  const [problemSolving, setProblemSolving] = useState<string>("");
  const [currentUserId] = useState<number>(1); // adjust if you obtain the real user id

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!LAB_ID) {
        console.warn("Editlab: missing labId in query params");
        setTestCases([{ input: "", output: "", hiddenInput: "", hiddenOutput: "", score: "" }]);
        return;
      }

      try {
        // Fetch lab metadata + testcases in parallel
        const [labResp, tcResp] = await Promise.allSettled([
          apiGetLab(LAB_ID),
          apiGetTestcases(LAB_ID)
        ]);

        // --- handle lab data (if available) ---
        if (labResp.status === "fulfilled") {
          const labData = labResp.value;
          // backend might return { lab: {...} } or directly the lab object
          const labObj = labData?.lab ?? labData ?? null;

          if (labObj) {
            // try several common field names as fallback
            const nameVal = labObj.labname ?? labObj.name ?? labObj.title ?? "";
            setLabName(String(nameVal ?? ""));

            // try dateline/dueDate/deadline - convert to yyyy-mm-dd for date input
            const rawDate = labObj.dateline ?? labObj.dueDate ?? labObj.deadline ?? labObj.date ?? "";
            if (rawDate) {
              // If rawDate is timestamp/ISO, convert; if already yyyy-mm-dd, keep it
              let isoDate = "";
              try {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                  isoDate = d.toISOString().slice(0, 10); // yyyy-mm-dd
                } else {
                  // fallback: if it's already a string like '2024-12-31', use it
                  isoDate = String(rawDate).slice(0, 10);
                }
              } catch {
                isoDate = String(rawDate).slice(0, 10);
              }
              setDateline(isoDate);
            }

            // problem solving / description / detail
            const problemVal = labObj.problemSolving ?? labObj.description ?? labObj.detail ?? labObj.note ?? "";
            setProblemSolving(String(problemVal ?? ""));
          }
        } else {
          console.warn("apiGetLab failed:", labResp.reason);
        }

        // --- handle testcases (if available) ---
        let list: any[] = [];
        if (tcResp.status === "fulfilled") {
          const tcData = tcResp.value;
          list = Array.isArray(tcData) ? tcData : (tcData?.data ?? tcData?.testcases ?? []);
        } else {
          console.warn("apiGetTestcases failed:", tcResp.reason);
        }

        // parse helpers (same logic as before)
        const parseVal = (val: any): any => {
          if (typeof val === "string") {
            const trimmed = val.trim();
            try {
              const parsed = JSON.parse(val);
              return parseVal(parsed);
            } catch {
              if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                const content = trimmed.slice(1, -1);
                const items = content.split(",").map(part => {
                  const p = part.trim();
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
          const rawInput = parseVal(tc.inputVal);
          const rawOutput = parseVal(tc.outputVal);
          const rawHiddenInput = parseVal(tc.inHiddenVal ?? tc.inHiddenVal);
          const rawHiddenOutput = parseVal(tc.outHiddenVal ?? tc.outHiddenVal);

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
        console.error("Failed to load lab/testcases", err);
        setTestCases([{ input: "", output: "", hiddenInput: "", hiddenOutput: "", score: "" }]);
      }
    };
    loadData();
  }, [LAB_ID]);

  // เพิ่ม Testcase
  const addTestCase = () => {
    setTestCases([
      ...testCases,
      { input: "", output: "", hiddenInput: "", hiddenOutput: "", score: "" },
    ]);
  };

  // ลบ Testcase
  const requestDeleteTestcase = (index: number) => {
    setDeleteTargetIndex(index);
  };

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
    router.push("/mylab");
  };

  // <-- UPDATED handleSave: send stringified values so Prisma (String fields) won't choke
  const handleSave = async () => {
    if (!LAB_ID) {
      alert("Missing labId, cannot save");
      return;
    }

    try {
      // helper: turn comma-separated UI string into array of trimmed values
      const toArray = (str: string) =>
        String(str ?? "")
          .split(",")
          .map(s => s.trim())
          .filter(s => s !== "");

      // Prepare payload: stringify arrays so backend receives a String
      const testcasesPayload = testCases.map(tc => {
        const inArr = toArray(tc.input);
        const outArr = toArray(tc.output);
        const inHiddenArr = toArray(tc.hiddenInput);
        const outHiddenArr = toArray(tc.hiddenOutput);

        return {
          // send JSON string for each field (backend expects String)
          inputVal: JSON.stringify(inArr),
          outputVal: JSON.stringify(outArr),
          inHiddenVal: JSON.stringify(inHiddenArr),
          outHiddenVal: JSON.stringify(outHiddenArr),
          score: Number(tc.score) || 0
        };
      });

      const payload: any = {
        labname: labName || "Untitled Lab",
        testcases: testcasesPayload,
        currentUserId: currentUserId
      };

      // include dateline/problemSolving if present
      if (dateline) payload.dateline = dateline;
      if (problemSolving) payload.problemSolving = problemSolving;

      const resp = await apiUpdateLab(LAB_ID, payload);

      // map returned testcases (if backend returned parsed arrays or JSON strings)
      const returnedTestcases = resp?.lab?.testcases ?? resp?.testcases ?? resp?.data ?? null;

      if (returnedTestcases && Array.isArray(returnedTestcases)) {
        const mapped = returnedTestcases.map((tc: any) => {
          // tc.inputVal might be an array (if backend parsed it) or a JSON string.
          const parseField = (v: any) => {
            if (Array.isArray(v)) return v.join(",");
            try {
              const p = JSON.parse(v);
              return Array.isArray(p) ? p.join(",") : String(p ?? "");
            } catch {
              // fallback: treat as plain comma-separated string
              return String(v ?? "");
            }
          };

          return {
            id: tc.testcaseId ?? tc.id,
            input: parseField(tc.inputVal),
            output: parseField(tc.outputVal),
            hiddenInput: parseField(tc.inHiddenVal),
            hiddenOutput: parseField(tc.outHiddenVal),
            score: String(tc.score ?? 0)
          };
        });
        setTestCases(mapped);
      }

      alert("Saved successfully!");
      router.push("/mylab");
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

              {/* Use a button for Save so we can finish save then navigate */}
              <button
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
              </button>
            </div>

            {/* ชื่อหัวข้อ */}
            <h2 className="text-3xl md:text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-6">
              Edit Lab
            </h2>

            <div className="flex flex-col md:flex-row gap-6">
              {/* ส่วนซ้าย */}
              <div className="flex-1 space-y-6">
                {/* Name และ Dateline (controlled) */}
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Name
                    </label>
                    <input
                      type="text"
                      value={labName}
                      onChange={(e) => setLabName(e.target.value)}
                      placeholder="Name..."
                      className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="w-full md:w-1/4">
                    <label className="block text-sm font-medium text-gray-700">Dateline</label>
                    <input
                      type="date"
                      value={dateline}
                      onChange={(e) => setDateline(e.target.value)}
                      className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Problem Solving (controlled) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Problem solving
                  </label>
                  <textarea
                    value={problemSolving}
                    onChange={(e) => setProblemSolving(e.target.value)}
                    placeholder="Detail..."
                    className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 h-32"
                  />
                </div>

                {/* Testcases (unchanged) */}
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-4 ">
                    Create Testcase
                  </h3>

                  {testCases.map((testCase, index) => (
                    <div
                      key={testCase.id ?? index}
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
