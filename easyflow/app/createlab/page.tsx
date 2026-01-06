"use client";

import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import { useRouter } from "next/navigation";
import { apiCreateTestcase, apiCreateLab } from "@/app/service/FlowchartService"; // <-- import APIs

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

  const toISODueDate = (dateOnly: string) => {
    // dateOnly expected "YYYY-MM-DD" -> convert to "YYYY-MM-DDT23:59:59Z"
    if (!dateOnly) return null;
    // keep as UTC end-of-day
    return new Date(`${dateOnly}T23:59:59Z`).toISOString();
  };

  const handleCreate = async () => {
    setSubmitting(true);

    try {
      // 1) สร้าง Lab บน server ก่อน
      const labPayload: any = {
        ownerUserId: 1, // ปรับถ้าจำเป็น
        labname: name || "Untitled Lab",
        problemSolving: problem || "",
      };

      const dueDateIso = toISODueDate(dateline);
      if (dueDateIso) {
        labPayload.dueDate = dueDateIso;
      }

      // คุณอาจเลือกส่ง testcases ใน payload นี้ได้ ถ้า backend รองรับ
      // แต่ที่นี่ผมสร้าง lab ก่อน แล้วส่ง testcase ทีละอันด้วย endpoint แยก
      console.log("[Createlab] creating lab on server with payload:", labPayload);

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

      console.log("[Createlab] created labId =", labId);

      // 2) ส่ง testcases ขึ้น server ทีละอัน (apiCreateTestcase)
      const promises = testCases.map((tc, idx) => {
        const payload = {
          // ผมเลือกส่งเป็น array ตาม logic เดิม (backend ของคุณอาจรับทั้ง array หรือ string)
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
        };

        console.log(`[Createlab] sending testcase[${idx}] payload ->`, payload);

        return apiCreateTestcase(String(labId), payload)
          .then((res) => {
            console.log(`[Createlab] testcase[${idx}] created ->`, res);
            return { status: "fulfilled", value: res };
          })
          .catch((err) => {
            console.error(`[Createlab] testcase[${idx}] error ->`, err);
            // rethrow so Promise.allSettled catches as rejected
            throw err;
          });
      });

      const results = await Promise.allSettled(promises);
      console.log("[Createlab] all testcase results ->", results);

      const rejected = results.filter((r) => r.status === "rejected");
      if (rejected.length > 0) {
        console.error("Some testcase uploads failed:", rejected);
        // เก็บ lab ลง localStorage พร้อมสถานะว่ามี testcase ล้มเหลว
        const newLabLocal = {
          id: Date.now(),
          labId,
          name,
          dateline,
          problem,
          testCases,
          symbols,
          createdAt: new Date().toISOString(),
          remoteCreated: true,
          testcaseUploadStatus: "partial-failure",
        };

        const stored = localStorage.getItem("labs");
        const labs = stored ? JSON.parse(stored) : [];
        labs.push(newLabLocal);
        localStorage.setItem("labs", JSON.stringify(labs));

        alert(
          "สร้าง Lab สำเร็จ แต่มีบาง Testcase ส่งไป server ไม่สำเร็จ ดู console log สำหรับรายละเอียด"
        );
      } else {
        // ทุก testcase สำเร็จ
        const newLabLocal = {
          id: Date.now(),
          labId,
          name,
          dateline,
          problem,
          testCases,
          symbols,
          createdAt: new Date().toISOString(),
          remoteCreated: true,
          testcaseUploadStatus: "all-ok",
        };

        const stored = localStorage.getItem("labs");
        const labs = stored ? JSON.parse(stored) : [];
        labs.push(newLabLocal);
        localStorage.setItem("labs", JSON.stringify(labs));

        alert("สร้าง Lab และส่ง Testcase ขึ้น server เรียบร้อยแล้ว");
      }

      // option: ถ้าต้องการ เซฟ labId เป็น environment variable ใน Postman/อื่น ๆ
      // สามารถดู console.log(labId)

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

                <div className="text-sm text-gray-600">Sending testcases to server (will create lab first)</div>

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
