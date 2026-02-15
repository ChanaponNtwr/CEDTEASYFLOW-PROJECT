"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import { useRouter } from "next/navigation";
import { apiCreateTestcase, apiCreateLab } from "@/app/service/FlowchartService"; 
import { useSession } from "next-auth/react"; // [1] Import Session
import { useSearchParams } from "next/navigation";

interface TestCase {
  input: string;
  output: string;
  hiddenInput: string;
  hiddenOutput: string;
  score: string | number;
}

export default function Createlab() {
  const MAX_LINES = 15;
  const MAX_CHARS = 2500;

  const handleProblemChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;

    // 1️⃣ จำกัดตัวอักษร
    if (value.length > MAX_CHARS) return;

    // 2️⃣ จำกัดจำนวนบรรทัด (Enter)
    const lines = value.split("\n").length;
    if (lines > MAX_LINES) return;

    setProblem(value);
  };

  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  // [2] เรียกใช้ session
  const { data: session } = useSession();

  const [name, setName] = useState("");
  const [dateline, setDateline] = useState("");
  const [problem, setProblem] = useState("");

  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "", output: "", hiddenInput: "", hiddenOutput: "", score: "" },
  ]);

  const [symbols, setSymbols] = useState({
    input: 0,
    output: 0,
    declare: 0,
    assign: 0,
    if: 0,
    for: 0,
    while: 0,
    do: 0,
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
  if (from === "Selectlab") {
    router.push("/Selectlab");
  } else {
    router.push("/mylab");
  }
  };

  // helper: แปลง string -> (number|string)[]
  const parseValues = (raw: string) => {
    if (!raw) return [];
    const hasComma = raw.indexOf(",") !== -1;
    const parts = hasComma ? raw.split(",") : raw.split(/\s+/);
    return parts
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map((s) => {
        const n = Number(s);
        return Number.isNaN(n) ? s : n;
      });
  };

  const toISODueDate = (dateOnly: string) => {
    if (!dateOnly) return null;
    return new Date(`${dateOnly}T23:59:59Z`).toISOString();
  };

  const handleCreate = async () => {
    setSubmitting(true);

    try {
      const dueDateIso = toISODueDate(dateline);

      // --- [ส่วนที่แก้ไขสำคัญ] ดึง ID จาก Session ---
      const userSession = session?.user as any;
      // พยายามหา id หรือ userId จาก object
      const rawId = userSession?.id || userSession?.userId;
      
      // ถ้าไม่มี ID ใน Session จะแจ้งเตือนที่ Console และใช้ 1 เป็นค่าสำรอง
      if (!rawId) {
        console.warn("⚠️ Warning: ไม่พบ ID ของ User ใน Session! ระบบจะใช้ค่า Default: 1 (โปรดตรวจสอบการตั้งค่า NextAuth Callbacks)");
      }

      const ownerId = rawId ? Number(rawId) : 1;
      
      console.log("Creating Lab with Owner ID:", ownerId); // เช็ค log นี้ว่าเลขอะไร
      // ------------------------------------------

      const labPayload: any = {
        ownerUserId: ownerId, 
        labname: name || "Untitled Lab",
        problemSolving: problem || "",
        status: "active",
        inSymVal: Number(symbols.input) || 0,
        outSymVal: Number(symbols.output) || 0,
        declareSymVal: Number(symbols.declare) || 0,
        assignSymVal: Number(symbols.assign) || 0,
        ifSymVal: Number(symbols.if) || 0,
        forSymVal: Number(symbols.for) || 0,
        whileSymVal: Number(symbols.while) || 0,
      };

      if (dueDateIso) {
        labPayload.dueDate = dueDateIso;
      }

      labPayload.testcases = testCases.map((tc) => ({
        inputVal: parseValues(tc.input),
        outputVal: parseValues(tc.output),
        score: Number(tc.score) || 0,
        inHiddenVal:
          tc.hiddenInput && tc.hiddenInput.trim()
            ? parseValues(tc.hiddenInput)
            : null,
        outHiddenVal:
          tc.hiddenOutput && tc.hiddenOutput.trim()
            ? parseValues(tc.hiddenOutput)
            : null,
      }));

      console.log("[Createlab] sending apiCreateLab payload:", labPayload);

      const createLabResp = await apiCreateLab(labPayload);
      console.log("[Createlab] createLabResp ->", createLabResp);

      const labId =
        createLabResp && createLabResp.lab && createLabResp.lab.labId
          ? createLabResp.lab.labId
          : createLabResp?.labId ?? null;

      if (!labId) {
        console.error("[Createlab] labId not found in createLabResp", createLabResp);
        throw new Error("ไม่พบ labId ในการตอบกลับจาก server");
      }

      const serverCreatedTestcases =
        !!(
          (createLabResp.lab && Array.isArray(createLabResp.lab.testcases) && createLabResp.lab.testcases.length >= labPayload.testcases.length) ||
          (Array.isArray(createLabResp.testcases) && createLabResp.testcases.length >= labPayload.testcases.length)
        );

      // เตรียม Object สำหรับ LocalStorage
      // เพิ่ม field authorEmail และ author เพื่อให้ Mylab กรองข้อมูลได้ถูกต้อง
      const baseLabLocal = {
        id: Date.now(),
        labId,
        name,
        dateline,
        problem,
        testCases,
        symbols,
        createdAt: new Date().toISOString(),
        remoteCreated: true,
        authorEmail: session?.user?.email, 
        author: session?.user?.name,
      };

      if (!serverCreatedTestcases && labPayload.testcases.length > 0) {
        console.log("[Createlab] backend did not create testcases; falling back to apiCreateTestcase per item");
        const promises = labPayload.testcases.map((payload: any, idx: number) =>
          apiCreateTestcase(String(labId), payload)
            .then((res) => ({ status: "fulfilled", value: res }))
            .catch((err) => {
              console.error(`[Createlab] testcase[${idx}] error ->`, err);
              return { status: "rejected", reason: err };
            })
        );

        const results = await Promise.all(promises);
        const rejected = results.filter((r: any) => r.status === "rejected");

        const newLabLocal = {
            ...baseLabLocal,
            testcaseUploadStatus: rejected.length > 0 ? "partial-failure" : "all-ok",
        };

        const stored = localStorage.getItem("labs");
        const labs = stored ? JSON.parse(stored) : [];
        labs.push(newLabLocal);
        localStorage.setItem("labs", JSON.stringify(labs));

        if (rejected.length > 0) {
            alert("สร้าง Lab สำเร็จ แต่มีบาง Testcase ส่งไป server ไม่สำเร็จ");
        } else {
            alert("สร้าง Lab และส่ง Testcase ขึ้น server เรียบร้อยแล้ว");
        }

      } else {
        // Backend created testcases
        const newLabLocal = {
          ...baseLabLocal,
          testcaseUploadStatus: "all-ok",
        };

        const stored = localStorage.getItem("labs");
        const labs = stored ? JSON.parse(stored) : [];
        labs.push(newLabLocal);
        localStorage.setItem("labs", JSON.stringify(labs));

        alert("สร้าง Lab เรียบร้อยแล้ว");
      }

      if (from === "selectlab") {
        router.push("/Selectlab");
      } else {
        router.push("/mylab");
      }
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
                    <label className="text-lg font-medium mb-4">Name</label>
                    <input
                      type="text"
                      value={name}
                      placeholder='Name'
                      onChange={(e) => setName(e.target.value)}
                      className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  {/* <div className="w-full md:w-1/4">
                    <label className="block text-sm font-medium">Dateline</label>
                    <input
                      type="date"
                      value={dateline}
                      onChange={(e) => setDateline(e.target.value)}
                      className="bg-white mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div> */}
                </div>

                <div>
  <label className="text-lg font-medium mb-4">
    Problem Solving
    <span className="ml-2 text-xs text-gray-400">
      ({problem.length}/2500)
    </span>
  </label>

  <textarea
    value={problem}
    placeholder="Problem Solving"
    rows={15}
    onChange={handleProblemChange}
    className="
      bg-white mt-1 block w-full p-2
      border border-gray-300 rounded-md
      resize-none overflow-hidden
      leading-6
    "
  />
</div>

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