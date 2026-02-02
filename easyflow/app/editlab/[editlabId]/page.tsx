"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import Link from "next/link";
import { useSearchParams, useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  apiGetLab,
  apiGetTestcases,
  apiCreateTestcase,
  apiDeleteTestcase,
  apiUpdateLab,
} from "@/app/service/FlowchartService";

interface TestCase {
  id?: string | number;
  input: string;
  output: string;
  hiddenInput: string;
  hiddenOutput: string;
  score: string;
}

function Editlab() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const rawId = params?.editlabId || params?.labId || searchParams?.get("labId");
  const LAB_ID = rawId ? Number(rawId) : null;

  // Debug Log
  useEffect(() => {
    console.log("📌 [Editlab Debug]");
    console.log("   - Resolved LAB_ID:", LAB_ID);
    console.log("   - User ID from Session:", session?.user);
  }, [LAB_ID, session]);

  const [labName, setLabName] = useState<string>("");
  const [dateline, setDateline] = useState<string>("");
  const [problemSolving, setProblemSolving] = useState<string>("");

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);

  const [symbols, setSymbols] = useState({
    input: 0,
    output: 0,
    declare: 0,
    assign: 0,
    if: 0,
    while: 0,
    for: 0,
  });
  const [initialSymbolData, setInitialSymbolData] = useState<any>(null);

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      if (!LAB_ID) return;

      console.log(`🚀 Loading data for Lab ID: ${LAB_ID}`);

      try {
        const [labResp, tcResp] = await Promise.allSettled([
          apiGetLab(LAB_ID),
          apiGetTestcases(LAB_ID)
        ]);

        // --- Handle Lab Data ---
        if (labResp.status === "fulfilled") {
          const labData = labResp.value;
          const labObj = labData?.lab ?? labData ?? null;

          if (labObj) {
            const nameVal = labObj.labname ?? labObj.name ?? labObj.title ?? "";
            setLabName(String(nameVal ?? ""));

            const rawDate = labObj.dateline ?? labObj.dueDate ?? labObj.deadline ?? labObj.date ?? "";
            if (rawDate) {
              try {
                const d = new Date(rawDate);
                if (!isNaN(d.getTime())) {
                  // format YYYY-MM-DD for input type="date"
                  const isoDate = d.toISOString().split('T')[0];
                  setDateline(isoDate);
                } else {
                  setDateline(String(rawDate));
                }
              } catch {
                setDateline(String(rawDate));
              }
            }

            const problemVal = labObj.problemSolving ?? labObj.description ?? labObj.detail ?? labObj.note ?? "";
            setProblemSolving(String(problemVal ?? ""));

            const loadedSymbols = {
                input: labObj.inSymVal ?? 0,
                output: labObj.outSymVal ?? 0,
                declare: labObj.declareSymVal ?? 0,
                assign: labObj.assignSymVal ?? 0,
                if: labObj.ifSymVal ?? 0,
                while: labObj.whileSymVal ?? 0,
                for: labObj.forSymVal ?? 0,
            };
            setSymbols(loadedSymbols);
            setInitialSymbolData(loadedSymbols);
          }
        }

        // --- Handle Testcases ---
        let list: any[] = [];
        if (tcResp.status === "fulfilled") {
          const tcData = tcResp.value;
          list = Array.isArray(tcData) ? tcData : (tcData?.data ?? tcData?.testcases ?? []);
        }

        const parseVal = (val: any): any => {
          if (typeof val === "string") {
            const trimmed = val.trim();
            try {
              const parsed = JSON.parse(val);
              return parseVal(parsed);
            } catch {
              if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
                const content = trimmed.slice(1, -1);
                // Simple CSV split logic for basic arrays
                const items = content.split(",").map(part => {
                   let p = part.trim();
                   if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
                     p = p.slice(1, -1);
                   }
                   return p;
                });
                return parseVal(items);
              }
              return val;
            }
          }
          if (Array.isArray(val)) return val.map(parseVal);
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
            if (Array.isArray(v)) return flattenDeep(v).join(",");
            return String(v ?? "");
          };

          return {
            id: tc.testcaseId ?? tc.id, // เก็บ ID ไว้ใช้อัปเดต
            input: format(rawInput),
            output: format(rawOutput),
            hiddenInput: format(rawHiddenInput),
            hiddenOutput: format(rawHiddenOutput),
            score: String(tc.score ?? 0)
          };
        });

        setTestCases(mapped.length > 0 ? mapped : [{ input: "", output: "", hiddenInput: "", hiddenOutput: "", score: "" }]);
      } catch (err) {
        console.error("Failed to load data", err);
      }
    };
    loadData();
  }, [LAB_ID]);

  // Handlers
  const addTestCase = () => {
    setTestCases([...testCases, { input: "", output: "", hiddenInput: "", hiddenOutput: "", score: "" }]);
  };

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

  const cancelDelete = () => setDeleteTargetIndex(null);

  const handleTestCaseChange = (index: number, field: keyof TestCase, value: string) => {
    const updated = [...testCases];
    updated[index][field] = value;
    setTestCases(updated);
  };

  const handleSymbolChange = (newSymbols: any) => {
    setTimeout(() => {
        setSymbols(newSymbols);
    }, 0);
  };

  const handleCancel = () => {
    router.push("/mylab");
  };

  // ✅ แก้ไขฟังก์ชัน handleSave
  const handleSave = async () => {
    if (!LAB_ID) {
      alert("Missing labId");
      return;
    }

    if (!session?.user) {
        alert("Session Expired");
        return;
    }

    const user = session.user as any;
    const realUserId = Number(user.id || user.userId || user.sub);

    try {
      const toArray = (str: string) =>
        String(str ?? "").split(",").map(s => s.trim()).filter(s => s !== "");

      // ✅ 1. ตรวจสอบ Payload ของ Testcase
      const testcasesPayload = testCases.map(tc => {
        const inArr = toArray(tc.input);
        const outArr = toArray(tc.output);
        const inHiddenArr = toArray(tc.hiddenInput);
        const outHiddenArr = toArray(tc.hiddenOutput);

        return {
          // 🔥 สำคัญ: ต้องส่ง ID ไปด้วยถ้าเป็นการแก้ไข (ถ้าเป็นของใหม่ id จะไม่มี)
          testcaseId: tc.id ? Number(tc.id) : undefined, 
          inputVal: JSON.stringify(inArr),
          outputVal: JSON.stringify(outArr),
          inHiddenVal: JSON.stringify(inHiddenArr),
          outHiddenVal: JSON.stringify(outHiddenArr),
          score: Number(tc.score) || 0
        };
      });

      // ✅ 2. ตรวจสอบ Date
      let finalDate = dateline;
      if (dateline) {
        // ถ้า Backend ต้องการ ISO (เช่น 2024-01-01T00:00:00.000Z) ให้แปลงตรงนี้
        // finalDate = new Date(dateline).toISOString(); 
        // แต่ถ้า Backend รับ YYYY-MM-DD ก็ใช้ค่าเดิม
      }

const payload: any = {
        labId: LAB_ID,
        labname: labName,
        testcases: testcasesPayload,
        currentUserId: realUserId,
        
        inSymVal: symbols.input,
        outSymVal: symbols.output,
        declareSymVal: symbols.declare,
        assignSymVal: symbols.assign,
        ifSymVal: symbols.if,
        whileSymVal: symbols.while,
        forSymVal: symbols.for,
      };

      // 🔴 ลองเปลี่ยนชื่อ key ตรงนี้
      if (dateline) {
         // ลองส่งเป็น dueDate แทน dateline
         payload.dueDate = dateline; 
         // หรือถ้า backend ต้องการ dateline จริงๆ ให้ใช้บรรทัดล่าง
         // payload.dateline = dateline;
      }
      
      if (problemSolving) payload.problemSolving = problemSolving;

      console.log("📤 Sending Payload:", JSON.stringify(payload, null, 2));

      await apiUpdateLab(LAB_ID, payload);

      alert("Saved successfully!");
      router.push("/mylab");

    } catch (err: any) {
      console.error("Save failed detail:", err);
      
      // ✅ เพิ่มการดึงข้อความ Error จาก Backend มาแสดง
      // เพื่อดูว่า 400 Bad Request เพราะอะไรกันแน่
      const responseData = err?.response?.data;
      const errorMessage = 
          responseData?.message || 
          responseData?.error || 
          JSON.stringify(responseData) || 
          err.message;

      alert(`Save failed (400): ${errorMessage}`);
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <div className="pl-60">
        <Navbar />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 flex flex-col p-6 md:p-10">
            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 mb-6">
              <Link
                href="/mylab"
                className="bg-[#D21F3C] text-white px-4 py-2 rounded-full flex items-center hover:bg-[#B81C35]"
              >
                Cancel
              </Link>
              <button
                onClick={handleSave}
                className="bg-[#2E8B57] text-white px-4 py-2 rounded-full flex items-center hover:bg-[#267347]"
              >
                Save
              </button>
            </div>

            <h2 className="text-3xl md:text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-6">
              Edit Lab
            </h2>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      value={labName}
                      onChange={(e) => setLabName(e.target.value)}
                      className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                    />
                  </div>
                  <div className="w-full md:w-1/4">
                    <label className="block text-sm font-medium text-gray-700">Dateline</label>
                    <input
                      type="date"
                      value={dateline}
                      onChange={(e) => setDateline(e.target.value)}
                      className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Problem solving</label>
                  <textarea
                    value={problemSolving}
                    onChange={(e) => setProblemSolving(e.target.value)}
                    className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm h-32"
                  />
                </div>

                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-4 ">Create Testcase</h3>
                  {testCases.map((testCase, index) => (
                    <div key={testCase.id ?? index} className="relative border rounded-lg p-4 mb-4 shadow-sm bg-gray-50">
                      <button
                        onClick={() => requestDeleteTestcase(index)}
                        className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                      >
                         {/* SVG Icon */}
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>

                      <div className="mb-2 text-gray-700 font-semibold">Testcase {index + 1}</div>

                      <div className="grid grid-cols-12 gap-4 mb-3 ml-5">
                        <div className="col-span-6">
                          <label className="block text-sm text-gray-700 mb-1">Input</label>
                          <input
                            type="text"
                            value={testCase.input}
                            onChange={(e) => handleTestCaseChange(index, "input", e.target.value)}
                            className="w-full bg-white p-2 border border-gray-300 rounded-md shadow-sm"
                          />
                        </div>
                        <div className="col-span-6">
                          <label className="block text-sm text-gray-700 mb-1">Output</label>
                          <input
                            type="text"
                            value={testCase.output}
                            onChange={(e) => handleTestCaseChange(index, "output", e.target.value)}
                            className="w-full bg-white p-2 border border-gray-300 rounded-md shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-4 ml-5">
                        <div className="col-span-6">
                          <label className="block text-sm text-gray-700 mb-1">Hidden Input</label>
                          <input
                            type="text"
                            value={testCase.hiddenInput}
                            onChange={(e) => handleTestCaseChange(index, "hiddenInput", e.target.value)}
                            className="w-full bg-white p-2 border border-gray-300 rounded-md shadow-sm"
                          />
                        </div>
                        <div className="col-span-6">
                          <label className="block text-sm text-gray-700 mb-1">Hidden Output</label>
                          <input
                            type="text"
                            value={testCase.hiddenOutput}
                            onChange={(e) => handleTestCaseChange(index, "hiddenOutput", e.target.value)}
                            className="w-full bg-white p-2 border border-gray-300 rounded-md shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-4 mb-3 ml-5">
                         <div className="col-span-6">
                          <label className="block text-sm text-gray-700 mb-1">Score</label>
                          <input
                            type="text"
                            value={testCase.score}
                            onChange={(e) => handleTestCaseChange(index, "score", e.target.value)}
                            className="w-full bg-white p-2 border border-gray-300 rounded-md shadow-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end mt-4">
                    <button onClick={addTestCase} className="text-sm text-black hover:underline">
                      + Add to Your Testcase
                    </button>
                  </div>
                </div>
              </div>

              <SymbolSection 
                onChange={handleSymbolChange} 
                initialValues={initialSymbolData} 
              />
            </div>
          </div>
        </div>
      </div>

      {deleteTargetIndex !== null && (
        <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-md flex items-center justify-center z-[1000]">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl">
            <div className="mb-6 flex flex-col items-center text-center">
               <h3 className="text-3xl font-medium text-gray-900">Delete Testcase</h3>
               <p className="text-gray-500 mt-2">Are you sure?</p>
            </div>
            <div className="flex justify-center gap-4 mt-6">
              <button onClick={cancelDelete} className="px-8 py-2.5 bg-gray-200 text-gray-700 rounded-full">Cancel</button>
              <button onClick={confirmDelete} className="px-8 py-2.5 bg-red-600 text-white rounded-full">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Editlab;