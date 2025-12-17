"use client";
import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import SymbolSection from "./_components/SymbolSection";
import Link from "next/link";
import { apiPostFlowchart } from "@/app/service/FlowchartService";
import { useRouter } from "next/navigation";

// Define TestCase interface
interface TestCase {
  no: number;
  input: string;
  output: string;
  score: number;
  status?: "Pass" | "Pending" | "Fail";
}

function Studentlab() {
  const router = useRouter();

  const [testCases, setTestCases] = useState<TestCase[]>([
    { no: 1, input: "n = 8", output: "32", score: 5 },
    { no: 2, input: "i = 1", output: "true", score: 4 },
    { no: 3, input: "i = 2", output: "false", score: 2 },
  ]);

  const computeStatus = (score: number): "Pass" | "Pending" | "Fail" => {
    if (score >= 5) return "Pass";
    if (score >= 3) return "Pending";
    return "Fail";
  };

  const enhancedTestCases = testCases.map((tc) => ({
    ...tc,
    status: computeStatus(tc.score),
  }));

  const [symbols, setSymbols] = useState({
    input: 0,
    output: 0,
    declare: 0,
    assign: 0,
    if: 5,
  });

  const updateSymbolCount = (newSymbols: typeof symbols) => {
    setSymbols(newSymbols);
  };

  // --- main handler: ส่ง payload ที่ต้องการไป backend ---
  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    // TODO: เปลี่ยนค่า userId / labId ให้เป็นของจริง (จาก user session, props, หรือ router query)
    const userId = 2;
    const labId = 2;

    // สร้าง payload ที่จะส่ง (ใส่ฟิลด์อื่นๆ ได้ตามต้องการ)
    const payload = {
      userId,
      labId,
      name: "Example Flowchart",
      // แนบข้อมูลจำลองเพิ่มเติม เช่น symbol counts และ testcases (ถ้าต้องการ)
      symbols,
      testCases: enhancedTestCases,
    };

    try {
      // ---- Option A: ถ้า apiPostFlowchart รองรับการรับ payload แบบนี้ ----
      if (typeof apiPostFlowchart === "function") {
        try {
          const result = await apiPostFlowchart(payload);
          console.log("apiPostFlowchart response:", result);
          // นำทางไปยังหน้า Dolab หรือใช้ flowchartId ถ้ามี
          // if (result?.flowchartId) router.push(`/Dolab/${result.flowchartId}`);
          router.push(`/Dolab`);
          return;
        } catch (err) {
          console.warn("apiPostFlowchart failed, falling back to fetch:", err);
          // ถ้า fail จะไปทำ fetch ด้านล่างเป็น fallback
        }
      }

      // ---- Option B: ส่งตรงด้วย fetch ไปที่ endpoint (ตัวอย่าง) ----
      const res = await fetch("http://localhost:8080/flowchart/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: payload.userId,
          labId: payload.labId,
          // ถ้าต้องการส่งน้อย ๆ ก็ส่งแค่ userId + labId ตามที่ระบุ
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} - ${text}`);
      }

      const result = await res.json();
      console.log("fetch response:", result);

      // ถ้า backend ส่งกลับ flowchartId ให้ใช้พาไปหน้าเฉพาะ
      if (result?.flowchartId) {
        router.push(`/Dolab/${result.flowchartId}`);
      } else {
        router.push(`/Dolab`);
      }
    } catch (error) {
      console.error("Failed to post flowchart:", error);
      // แสดง toast / UI แจ้งข้อผิดพลาดได้ที่นี่
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-100">
      <div className="pt-20 pl-52">
        <Navbar />
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex justify-center p-6 md:p-10">
            <div className="w-full max-w-5xl bg-white p-6 rounded-lg shadow-md">
              {/* Buttons */}
              <div className="flex justify-end mb-2">
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center justify-center hover:bg-blue-700 w-24"
                  onClick={handleClick}
                >
                  Do lab
                </button>
              </div>
              <div className="flex justify-end mb-2">
                <Link
                  href="/"
                  className="bg-[#133384] text-white px-4 py-2 rounded-full flex items-center justify-center hover:bg-[#1945B7] w-24"
                >
                  Submit
                </Link>
              </div>

              {/* Title */}
              <div className="flex justify-between items-center border-b-2 border-gray-300 pb-1 mb-6">
                <div className="flex items-center">
                  <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mr-4">
                    <img src="/images/lab.png" className="w-12 h-14" />
                  </div>
                  <h2 className="text-4xl font-semibold">
                    Lab 3 <span className="text-xs">(10 points)</span>
                  </h2>
                </div>
                <p className="text-gray-500 text-sm">Due Dec 31, 2024, 9:00 AM</p>
              </div>

              {/* Description */}
              <div className="ml-0 md:ml-10 mb-6">
                <p className="mb-6 text-gray-700">
                  รายวิชาการเขียนโปรแกรมคอมพิวเตอร์ 1 คะแนนเก็บ ครั้งที่ 1 ทำ N
                  ครั้งตามที่กำหนด
                  <br />
                  คำสั่ง: ทำตามขั้นตอนใน N ครั้งตามที่กำหนดให้ครบถ้วน
                </p>
                <div className="border-b-2 border-gray-300 pb-1 mb-6"></div>

                {/* Test Case Table */}
                <div className="flex-1 mb-8 overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          No.
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Input
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Output
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Score
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {enhancedTestCases.map((tc, index) => {
                        const statusClasses =
                          tc.status === "Pass"
                            ? "bg-green-100 text-green-800"
                            : tc.status === "Pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800";

                        return (
                          <tr
                            key={tc.no}
                            className={`transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-600">
                              {tc.no}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                              <span className="px-2 py-1 rounded text-xs text-gray-800">
                                {tc.input}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                              <span className="px-2 py-1 rounded text-xs text-blue-800">
                                {tc.output}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                              {tc.score}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses}`}>
                                {tc.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Symbols Section */}
                <div className="pt-5">
                  <h1 className="text-2xl font-bold text-gray-700 mb-2">Symbols</h1>
                  <SymbolSection onChange={updateSymbolCount} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Studentlab;