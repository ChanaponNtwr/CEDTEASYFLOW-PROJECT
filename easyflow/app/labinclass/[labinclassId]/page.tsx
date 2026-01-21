"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { FaFilter } from "react-icons/fa";
import Link from "next/link";
import SymbolSection from "./_components/SymbolSection";

// Import API Services
import { 
  apiGetLab, 
  apiGetTestcases, 
  apiGetSubmissionsByLab, 
  apiConfirmSubmission, 
  apiRejectSubmission 
} from "@/app/service/FlowchartService";

// --- Interfaces ---
interface TestCase {
  testcaseId: number;
  no: number;
  input: string;
  output: string;
  score: number;
}

interface LabData {
  labId: number;
  labname: string;
  detail: string;
  totalScore: number;
  testCases: TestCase[];
  // Symbol Data
  inSymVal?: number;
  outSymVal?: number;
  declareSymVal?: number;
  assignSymVal?: number;
  ifSymVal?: number;
  forSymVal?: number;
  whileSymVal?: number;
}

interface TestResult {
  status: string; // PASS, FAIL, PENDING
}

interface StudentSubmission {
  studentId: number | string;
  submissionId?: number;
  name: string;
  status: string; // submitted, pending, pass, fail
  score: number;
  maxScore: number;
  selected: boolean;
  results: TestResult[]; 
}

function LabInClass() {
  const params = useParams();
  const router = useRouter();
  
  const rawId = params?.labinclassId;
  const labId = Array.isArray(rawId) ? rawId[0] : rawId;

  // --- States ---
  const [loading, setLoading] = useState(true);
  const [labData, setLabData] = useState<LabData | null>(null);
  const [students, setStudents] = useState<StudentSubmission[]>([]);
  const [filterStatus, setFilterStatus] = useState("All");

  // --- Fetch Data ---
  useEffect(() => {
    if (!labId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [labResp, tcResp] = await Promise.all([
           apiGetLab(String(labId)),
           apiGetTestcases(String(labId))
        ]);

        const remoteLab = labResp?.lab ?? labResp ?? null;
        
        let tcs: TestCase[] = [];
        const rawTcs = Array.isArray(tcResp) ? tcResp : (tcResp?.data ?? remoteLab?.testcases ?? []);
        
        tcs = rawTcs.map((tc: any, index: number) => ({
            testcaseId: tc.testcaseId ?? tc.id,
            no: index + 1,
            input: String(tc.inputVal || tc.input || ""),
            output: String(tc.outputVal || tc.output || ""),
            score: Number(tc.score || 0)
        }));

        const totalScore = tcs.reduce((acc, tc) => acc + tc.score, 0);

        setLabData({
            labId: Number(labId),
            labname: remoteLab?.labname ?? remoteLab?.name ?? "Unknown Lab",
            detail: remoteLab?.problemSolving ?? remoteLab?.problem ?? "",
            totalScore: totalScore,
            testCases: tcs,
            inSymVal: remoteLab?.inSymVal,
            outSymVal: remoteLab?.outSymVal,
            declareSymVal: remoteLab?.declareSymVal,
            assignSymVal: remoteLab?.assignSymVal,
            ifSymVal: remoteLab?.ifSymVal,
            forSymVal: remoteLab?.forSymVal,
            whileSymVal: remoteLab?.whileSymVal,
        });

        const subResp = await apiGetSubmissionsByLab(String(labId));
        const rawSubs = subResp?.data ?? subResp ?? [];

        const mappedStudents: StudentSubmission[] = rawSubs.map((sub: any) => {
            const results: TestResult[] = tcs.map((tc) => {
                const match = sub.results?.find((r: any) => r.testcaseId === tc.testcaseId);
                return { status: match?.status ?? "PENDING" };
            });

            return {
                studentId: sub.userId ?? sub.studentId ?? Math.random(),
                submissionId: sub.submissionId ?? sub.id,
                name: sub.user?.name ?? sub.studentName ?? "Unknown Student",
                status: sub.status ?? "pending",
                score: sub.score ?? 0,
                maxScore: totalScore,
                selected: false,
                results: results
            };
        });

        setStudents(mappedStudents);

      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [labId]);

  // --- Handlers ---
  const handleSelectAll = (checked: boolean) => {
    const updated = students.map((std) =>
      (filterStatus === "All" || std.status.toLowerCase() === filterStatus.toLowerCase())
        ? { ...std, selected: checked }
        : std
    );
    setStudents(updated);
  };

  const handleSelectStudent = (index: number) => {
    const updated = [...students];
    updated[index].selected = !updated[index].selected;
    setStudents(updated);
  };

  const handleSubmitAll = async () => {
    const selectedStudents = students.filter(s => s.selected);
    if (selectedStudents.length === 0) return;

    const confirmMsg = `ยืนยันการตรวจ (Confirm) นักเรียน ${selectedStudents.length} คน?`;
    if (!confirm(confirmMsg)) return;

    try {
        await Promise.all(selectedStudents.map(async (student) => {
            if (student.submissionId) {
                await apiConfirmSubmission(student.submissionId);
            }
        }));

        const updated = students.map((student) =>
            student.selected
              ? { ...student, status: "Pass", selected: false }
              : student
        );
        setStudents(updated);
        alert("บันทึกผลการตรวจเรียบร้อยแล้ว");

    } catch (error) {
        console.error("Failed to submit:", error);
        alert("เกิดข้อผิดพลาดในการบันทึก");
    }
  };

  const handleViewStudent = (submissionId?: number) => {
      if (submissionId) {
          router.push(`/checklab/${submissionId}`);
      }
  };

  const filteredStudents =
    filterStatus === "All"
      ? students
      : students.filter((student) => student.status.toLowerCase() === filterStatus.toLowerCase());

  const isAllChecked =
    filteredStudents.length > 0 && filteredStudents.every((s) => s.selected);

  const filterOptions = ["All", "Pass", "Submitted", "Pending", "Fail"];

  const renderStatusBadge = (status: string) => {
      const s = status.toLowerCase();
      let color = "bg-gray-100 text-gray-600 border-gray-200";
      
      if (s === "pass" || s === "graded") color = "bg-green-100 text-green-700 border-green-200";
      else if (s === "fail" || s === "rejected") color = "bg-red-100 text-red-700 border-red-200";
      else if (s === "submitted") color = "bg-blue-100 text-blue-700 border-blue-200";
      else if (s === "pending") color = "bg-yellow-100 text-yellow-700 border-yellow-200";

      return (
          <span className={`px-3 py-1 rounded-full text-xs font-bold border capitalize ${color}`}>
              {status}
          </span>
      );
  };

  if (loading) return <div className="p-20 text-center text-gray-500">Loading data...</div>;
  if (!labData) return <div className="p-20 text-center text-red-500">Lab not found.</div>;

  return (
    <div className="min-h-screen w-full bg-gray-100">
      <div className="pt-20 pl-52">
        <Navbar />
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex justify-center p-6 md:p-10">
            <div className="w-full max-w-6xl bg-white p-6 rounded-lg shadow-md">
              
              {/* Header Info */}
              <div className="flex justify-between items-center border-b-2 border-gray-300 pb-1 mb-6 mt-4">
                <div className="flex items-center">
                  <div className="w-20 h-20 bg-[#EEEEEE] rounded-full flex items-center justify-center mr-4">
                    <img src="/images/lab.png" className="w-12 h-14 object-contain" alt="Lab Icon" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-800">
                        {labData.labname}
                    </h2>
                    <span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md mt-1 inline-block">
                        Total Score: {labData.totalScore} points
                    </span>
                  </div>
                </div>
              </div>

              <div className="ml-0 md:ml-10">
                {/* Problem Description */}
                <p className="mb-6 text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {labData.detail || "No details provided."}
                </p>

                {/* ✅ ส่วนที่เพิ่ม: แสดงตาราง Testcase ตรงโจทย์ */}
                {labData.testCases.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">

                    </h3>
                    <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">No.</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Input</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Output</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Score</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {labData.testCases.map((tc, index) => (
                            <tr key={tc.testcaseId || index} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                              <td className="px-6 py-3 text-sm text-gray-600 font-medium">{tc.no}</td>
                              <td className="px-6 py-3 text-sm text-gray-700">
                                <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono border border-gray-200">{tc.input}</code>
                              </td>
                              <td className="px-6 py-3 text-sm text-gray-700">
                                <code className="bg-blue-50 px-2 py-1 rounded text-xs font-mono text-blue-800 border border-blue-100">{tc.output}</code>
                              </td>
                              <td className="px-6 py-3 text-sm text-gray-600 text-center font-semibold">
                                {tc.score}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {/* จบส่วนตาราง Testcase */}

                <div className="border-b-2 border-gray-300 pb-1 mb-6"></div>

                {/* Filter + Submit Actions */}
                <div className="flex justify-end gap-4 mb-6 pt-5">
                  <div className="relative flex items-center">
                    <FaFilter className="absolute left-3 text-white text-sm pointer-events-none" />
                    <select
                      className="pl-9 pr-8 py-2 border rounded-full bg-[#B92627] text-white border-red-700 appearance-none cursor-pointer hover:bg-[#a02122] transition-colors focus:ring-2 focus:ring-red-300 focus:outline-none"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      {filterOptions.map((opt) => (
                        <option key={opt} className="bg-white text-black" value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                       <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>

                  <button
                    className={`px-5 py-2 rounded-full font-medium transition-all shadow-sm flex items-center
                      ${students.some((s) => s.selected)
                        ? "bg-[#2E8B57] text-white hover:bg-[#267347] active:scale-95"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                      }`}
                    onClick={handleSubmitAll}
                    disabled={!students.some((s) => s.selected)}
                  >
                    Submit Selected
                  </button>
                </div>

                {/* Student Table */}
                <div className="flex-1 mb-8 overflow-hidden rounded-xl border border-gray-200 shadow-sm bg-white overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left w-10">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                checked={isAllChecked}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                            />
                        </th>
                        
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                        
                        {/* Dynamic Testcase Headers */}
                        {labData.testCases.map((tc, idx) => (
                             <th key={idx} className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[80px]">
                                TC {tc.no}
                             </th>
                        ))}

                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Score</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredStudents.length === 0 ? (
                          <tr><td colSpan={10} className="px-6 py-12 text-center text-gray-500">No students found.</td></tr>
                      ) : (
                          filteredStudents.map((student, index) => {
                            const originalIndex = students.findIndex((s) => s.studentId === student.studentId);
                            return (
                              <tr key={student.studentId} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    checked={student.selected}
                                    onChange={() => handleSelectStudent(originalIndex)}
                                  />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {renderStatusBadge(student.status)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                                
                                {labData.testCases.map((_, idx) => {
                                    const res = student.results[idx];
                                    let dotColor = "bg-gray-300"; 
                                    let title = "Pending";

                                    if (res?.status === "PASS") { dotColor = "bg-green-500"; title = "Passed"; }
                                    else if (res?.status === "FAIL") { dotColor = "bg-red-500"; title = "Failed"; }
                                    
                                    return (
                                        <td key={idx} className="px-4 py-4 whitespace-nowrap text-center">
                                            <div className={`w-3 h-3 rounded-full mx-auto ${dotColor}`} title={title}></div>
                                        </td>
                                    );
                                })}

                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
                                    {student.score} / {student.maxScore}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <button 
                                    onClick={() => handleViewStudent(student.submissionId)}
                                    className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
                                        student.submissionId 
                                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm" 
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    }`}
                                    disabled={!student.submissionId}
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="pt-5">
                  <h1 className="text-2xl font-bold text-gray-700 mb-4">Symbol Configuration</h1>
                  <SymbolSection labData={labData} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LabInClass;