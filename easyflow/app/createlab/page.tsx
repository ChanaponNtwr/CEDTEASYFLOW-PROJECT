"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import { useRouter } from "next/navigation";
import { apiCreateTestcase } from "@/app/service/FlowchartService"; // <-- import API

interface TestCase {
  input: string;
  output: string;
  hiddenInput: string;
  hiddenOutput: string;
  score: string | number;
}

export default function Createlab() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [dateline, setDateline] = useState("");
  const [problem, setProblem] = useState("");

  // ใช้ mock labId แบบคงที่ = 2
  const serverLabId = "2";

  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "", output: "", hiddenInput: "", hiddenOutput: "", score: "" },
  ]);

  const [symbols, setSymbols] = useState({
    input: 0,
    output: 0,
    declare: 0,
    assign: 0,
    if: 0,
    call: 0,
  });

  const [submitting, setSubmitting] = useState(false);

  const addTestCase = () => {
    setTestCases([
      ...testCases,
      { input: "", output: "", hiddenInput: "", hiddenOutput: "", score: "" },
    ]);
  };

  const removeTestCase = (index: number) => {
    if (testCases.length === 1) return;
    const updated = [...testCases];
    updated.splice(index, 1);
    setTestCases(updated);
  };

  const handleTestCaseChange = (
    index: number,
    field: keyof TestCase,
    value: string
  ) => {
    const updated = [...testCases];
    updated[index][field] = value;
    setTestCases(updated);
  };

  const handleSymbolChange = (symbolData: any) => {
    setSymbols(symbolData);
  };

  const handleCancel = () => {
    router.push("/mylab");
  };

  // helper: แปลง string -> string[]
  const parseValues = (raw: string) => {
    if (!raw) return [];
    const hasComma = raw.indexOf(",") !== -1;
    const parts = hasComma ? raw.split(",") : raw.split(/\s+/);
    return parts.map((s) => s.trim()).filter((s) => s !== "");
  };

  const handleCreate = async () => {
    setSubmitting(true);

    const newLab = {
      id: Date.now(),
      name,
      dateline,
      problem,
      testCases,
      symbols,
      createdAt: new Date().toISOString(),
    };

    try {
      // อ่านข้อมูลเก่าจาก localStorage แล้วเซฟ lab ใหม่
      const stored = localStorage.getItem("labs");
      const labs = stored ? JSON.parse(stored) : [];
      labs.push(newLab);
      localStorage.setItem("labs", JSON.stringify(labs));

      console.log("[Createlab] saved lab to localStorage:", newLab);
      console.log("[Createlab] all labs in localStorage:", labs);

      // ส่ง testcases ขึ้น server โดยใช้ serverLabId = 2
      console.log(`[Createlab] will send ${testCases.length} testcase(s) to server labId=${serverLabId}`);

      const promises = testCases.map((tc, idx) => {
        const payload = {
          inputVal: parseValues(tc.input),
          outputVal: parseValues(tc.output),
          inHiddenVal: parseValues(tc.hiddenInput),
          outHiddenVal: parseValues(tc.hiddenOutput),
          score: Number(tc.score) || 0,
        };

        console.log(`[Createlab] payload for testcase[${idx}] ->`, payload);

        return apiCreateTestcase(serverLabId, {
          inputVal: payload.inputVal,
          outputVal: payload.outputVal,
          score: payload.score,
          inHiddenVal: payload.inHiddenVal && payload.inHiddenVal.length ? payload.inHiddenVal : null,
          outHiddenVal: payload.outHiddenVal && payload.outHiddenVal.length ? payload.outHiddenVal : null,
        })
          .then((res) => {
            console.log(`[Createlab] server response for testcase[${idx}] ->`, res);
            return res;
          })
          .catch((err) => {
            console.error(`[Createlab] server error for testcase[${idx}] ->`, err);
            throw err;
          });
      });

      const results = await Promise.allSettled(promises);

      console.log("[Createlab] all API results ->", results);

      const rejected = results.filter((r) => r.status === "rejected");
      if (rejected.length > 0) {
        console.error("Some testcase uploads failed:", rejected);
        alert("สร้าง Lab สำเร็จ แต่มีบาง Testcase ส่งไป server ไม่สำเร็จ ดู console เพิ่มเติม");
      } else {
        alert("สร้าง Lab และส่ง Testcase ขึ้น server เรียบร้อยแล้ว (ดู console log สำหรับรายละเอียด)");
      }

      router.push("/mylab");
    } catch (err) {
      console.error("handleCreate error:", err);
      alert("เกิดข้อผิดพลาด ข้อมูลอาจจะยังไม่ถูกส่ง กรุณาดู console");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <div className="pl-60">
        <Navbar />
        <div className="flex">
          <Sidebar />

          <div className="flex-1 flex flex-col p-6 md:p-10">
            {/* ปุ่ม */}
            <div className="flex justify-end space-x-4 mb-6">
              <button
                onClick={handleCancel}
                className="bg-red-500 text-white px-4 py-2 rounded-full flex items-center hover:bg-red-600"
              >
                Cancel
              </button>

              <button
                onClick={handleCreate}
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Create"}
              </button>
            </div>

            {/* Heading */}
            <h2 className="text-3xl md:text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-6">
              Create Lab
            </h2>

            <div className="flex flex-col md:flex-row gap-6">
              {/* LEFT */}
              <div className="flex-1 space-y-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div className="w-full md:w-1/4">
                    <label className="block text-sm font-medium">Dateline</label>
                    <input
                      type="date"
                      value={dateline}
                      onChange={(e) => setDateline(e.target.value)}
                      className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium">Problem Solving</label>
                  <textarea
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md h-32"
                  ></textarea>
                </div>

                <div className="text-sm text-gray-600">Sending testcases to server with mock labId = 2</div>

                {/* Testcases */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Create Testcase</h3>

                  {testCases.map((tc, idx) => (
                    <div
                      key={idx}
                      className="relative border rounded-lg p-4 mb-4 shadow bg-gray-50"
                    >
                      <button
                        onClick={() => removeTestCase(idx)}
                        className="absolute top-2 right-2 text-red-500"
                      >
                        ✕
                      </button>

                      <div className="mb-2 font-semibold">Testcase {idx + 1}</div>

                      <div className="grid grid-cols-12 gap-4 mb-3 ml-5">
                        <div className="col-span-6">
                          <label>Input</label>
                          <input
                            type="text"
                            value={tc.input as string}
                            onChange={(e) =>
                              handleTestCaseChange(idx, "input", e.target.value)
                            }
                            placeholder='เช่น 10,20,30 หรือ 10 20 30'
                            className="w-full p-2 border bg-white rounded-md"
                          />
                        </div>

                        <div className="col-span-6">
                          <label>Output</label>
                          <input
                            type="text"
                            value={tc.output as string}
                            onChange={(e) =>
                              handleTestCaseChange(idx, "output", e.target.value)
                            }
                            placeholder='เช่น 60'
                            className="w-full p-2 border bg-white rounded-md"
                          />
                        </div>
                      </div>

                      {/* Hidden */}
                      <div className="grid grid-cols-12 gap-4 ml-5">
                        <div className="col-span-6">
                          <label>Hidden Input</label>
                          <input
                            type="text"
                            value={tc.hiddenInput as string}
                            onChange={(e) =>
                              handleTestCaseChange(
                                idx,
                                "hiddenInput",
                                e.target.value
                              )
                            }
                            placeholder='เช่น 10,20,30 หรือ 10 20 30'
                            className="w-full p-2 border bg-white rounded-md"
                          />
                        </div>

                        <div className="col-span-6">
                          <label>Hidden Output</label>
                          <input
                            type="text"
                            value={tc.hiddenOutput as string}
                            onChange={(e) =>
                              handleTestCaseChange(
                                idx,
                                "hiddenOutput",
                                e.target.value
                              )
                            }
                            placeholder='เช่น 60'
                            className="w-full p-2 border bg-white rounded-md"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-4 mt-3 ml-5">
                        <div className="col-span-6">
                          <label>Score</label>
                          <input
                            type="number"
                            value={tc.score as number | string}
                            onChange={(e) =>
                              handleTestCaseChange(idx, "score", e.target.value)
                            }
                            placeholder='เช่น 5'
                            className="w-full p-2 border bg-white rounded-md"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end mt-4">
                    <button onClick={addTestCase} className="text-sm hover:underline">
                      + Add Testcase
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <SymbolSection onChange={handleSymbolChange} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
