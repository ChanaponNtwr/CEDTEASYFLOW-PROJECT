"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { FaFilter, FaCheck, FaTimes, FaSearch, FaChevronDown } from "react-icons/fa"; 
import { IoCheckmarkCircle, IoCloseCircle, IoRemoveCircleOutline } from "react-icons/io5";
import Link from "next/link";
import SymbolSection from "./_components/SymbolSection";
import { useSession } from "next-auth/react";

import { 
  apiGetLab, 
  apiGetTestcases, 
  apiGetSubmissionDetailsByLab, 
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

interface PageLabData {
  labId: number;
  labname: string;
  detail: string;
  totalScore: number;
  testCases: TestCase[];
  inSymVal: number;
  outSymVal: number;
  declareSymVal: number;
  assignSymVal: number;
  ifSymVal: number;
  forSymVal: number;
  whileSymVal: number;
}

interface TestResult {
  status: string;
  score: number;   
  maxScore: number; 
}

interface StudentSubmission {
  studentId: number | string;
  submissionId?: number;
  name: string;
  status: string; 
  score: number;
  maxScore: number;
  selected: boolean;
  results: TestResult[]; 
}

function LabInClass() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  
  const rawId = params?.labinclassId;
  const labId = Array.isArray(rawId) ? rawId[0] : rawId;

  const [loading, setLoading] = useState(true);
  const [labData, setLabData] = useState<PageLabData | null>(null);
  const [students, setStudents] = useState<StudentSubmission[]>([]);
  const [filterStatus, setFilterStatus] = useState("All");

  const fetchData = useCallback(async () => {
    if (!labId) return;
    
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
          inSymVal: remoteLab?.inSymVal ?? 0,
          outSymVal: remoteLab?.outSymVal ?? 0,
          declareSymVal: remoteLab?.declareSymVal ?? 0,
          assignSymVal: remoteLab?.assignSymVal ?? 0,
          ifSymVal: remoteLab?.ifSymVal ?? 0,
          forSymVal: remoteLab?.forSymVal ?? 0,
          whileSymVal: remoteLab?.whileSymVal ?? 0,
      });

      // --- Fetch Submissions ---
      const subResp = await apiGetSubmissionDetailsByLab(String(labId));
      const rawData = subResp?.data ?? subResp ?? [];
      const rawSubs = Array.isArray(rawData) ? rawData : [];

      const mappedStudents: StudentSubmission[] = rawSubs.map((item: any) => {
          const userObj = item.user || item.User || item.student || item.Student || item;
          const join = (f: any, l: any) => `${f || ""} ${l || ""}`.trim();

          let studentName = "Unknown Student";
          if (item.userName) studentName = item.userName;
          else if (userObj.firstname || userObj.lastname) studentName = join(userObj.firstname, userObj.lastname);
          else if (userObj.firstName || userObj.lastName) studentName = join(userObj.firstName, userObj.lastName);
          else if (userObj.name) studentName = userObj.name;
          else if (userObj.username) studentName = userObj.username;
          else if (userObj.email) studentName = userObj.email;

          const rawResults = item.testcases || item.results || item.submission?.results || [];

          let finalStatus = "PENDING"; 
          if (item.status) finalStatus = item.status;
          else if (item.submission?.status) finalStatus = item.submission.status;
          else if (Array.isArray(item.submissions) && item.submissions.length > 0) finalStatus = item.submissions[0].status;

          if ((!finalStatus || finalStatus === "PENDING") && rawResults.length > 0) {
              const firstTc = rawResults[0];
              if (firstTc && firstTc.status) {
                  finalStatus = firstTc.status;
              }
          }

          const score = item.totalScore ?? item.submission?.score ?? 0;
          const submissionId = item.flowchartId ?? item.submission?.id ?? item.submissionId ?? undefined;

          const results: TestResult[] = tcs.map((tc) => {
              const match = rawResults.find((r: any) => r.testcaseId === tc.testcaseId);
              const rStatus = match?.status ?? "PENDING";
              let rScore = 0;
              if (match?.scoreAwarded !== undefined) rScore = Number(match.scoreAwarded);
              else if (match?.score !== undefined) rScore = Number(match.score);
              else if (rStatus === "PASS" || rStatus === "CONFIRMED") rScore = tc.score;

              return { 
                  status: rStatus,
                  score: rScore,
                  maxScore: tc.score
              };
          });

          const studentId = item.userId ?? userObj.id ?? userObj.userId ?? userObj.studentId;

          return {
              studentId: studentId,
              submissionId: submissionId,
              name: studentName,
              status: finalStatus || "Pending", 
              score: score,
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
  }, [labId]);

  useEffect(() => {
      setLoading(true);
      fetchData();
  }, [fetchData]);

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
    const user = session?.user as any;
    const reviewerId = user?.id || user?.userId || user?.sub;
    if (!reviewerId) return alert("กรุณา Login ใหม่");

    const selectedStudents = students.filter(s => s.selected);
    if (selectedStudents.length === 0) return;

    if (!confirm(`ยืนยันการให้ผ่าน (Pass) นักเรียน ${selectedStudents.length} คน?`)) return;

    try {
        await Promise.all(selectedStudents.map(async (student) => {
            if (student.studentId) {
                await apiConfirmSubmission(String(labId), String(student.studentId), String(reviewerId));
            }
        }));
        alert("Success!");
        await fetchData(); 
    } catch (error: any) {
        alert(`Error: ${error.message}`);
    }
  };

  const handleRejectAll = async () => {
    const user = session?.user as any; 
    const reviewerId = user?.id || user?.userId || user?.sub;
    if (!reviewerId) return alert("กรุณา Login ใหม่");

    const selectedStudents = students.filter(s => s.selected);
    if (selectedStudents.length === 0) return;

    if (!confirm(`ยืนยันการปฏิเสธ (Reject) นักเรียน ${selectedStudents.length} คน?`)) return;

    try {
        await Promise.all(selectedStudents.map(async (student) => {
            if (student.studentId) {
                await apiRejectSubmission(String(labId), String(student.studentId), String(reviewerId));
            }
        }));
        alert("Rejected successfully");
        await fetchData();
    } catch (error: any) {
        alert(`Error: ${error.message}`);
    }
  };

  const handleViewStudent = (submissionId?: number) => {
      if (submissionId) router.push(`/Dolab/${submissionId}`);
  };

  const filteredStudents = filterStatus === "All"
      ? students
      : students.filter((student) => student.status.toLowerCase() === filterStatus.toLowerCase());

  const isAllChecked = filteredStudents.length > 0 && filteredStudents.every((s) => s.selected);
  const selectedCount = students.filter(s => s.selected).length;

  const filterOptions = ["All", "Confirmed", "Pass", "Submitted", "Pending", "Fail"];

  const renderStatusBadge = (status: string) => {
      const s = String(status || "").toUpperCase();
      let badgeStyle = "bg-gray-100 text-gray-600 border-gray-200"; 
      let dotColor = "bg-gray-400";

      if (["PASS", "PASSED", "CONFIRMED", "GRADED", "SUCCESS"].includes(s)) {
          badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
          dotColor = "bg-emerald-500";
      }
      else if (["FAIL", "FAILED", "REJECTED", "WRONG"].includes(s)) {
          badgeStyle = "bg-red-50 text-red-700 border-red-200";
          dotColor = "bg-red-500";
      }
      else if (["SUBMITTED", "SUBMIT"].includes(s)) {
          badgeStyle = "bg-blue-50 text-blue-700 border-blue-200";
          dotColor = "bg-blue-500";
      }
      else if (["PENDING", "WAITING", "UNKNOWN"].includes(s) || s === "") {
          badgeStyle = "bg-amber-50 text-amber-700 border-amber-200";
          dotColor = "bg-amber-500";
      }

      return (
          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border inline-flex items-center gap-2 capitalize ${badgeStyle}`}>
              <span className={`w-2 h-2 rounded-full ${s === "PENDING" ? "animate-pulse" : ""} ${dotColor}`}></span>
              {status?.toLowerCase() || "pending"}
          </span>
      );
  };

  if (loading && !labData) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-400 gap-3">
        <div className=""></div>
        <p className="">Loading data...</p>
    </div>
  );
  
  if (!labData) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-red-500 font-medium">
        Lab not found.
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#F9FAFB]">
      <div className="pt-20 pl-0 md:pl-64 transition-all duration-300">
        <Navbar />
        <Sidebar />
        
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
            
          {/* Header Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-gradient-to-br from-red-50 to-white rounded-xl flex items-center justify-center flex-shrink-0 border border-red-100 shadow-sm">
                <img src="/images/lab.png" className="w-7 h-auto object-contain" alt="Lab Icon" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">{labData.labname}</h1>
                <div className="flex items-center gap-3 mt-1.5 text-sm">
                    {/* <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-medium text-gray-600">ID: {labData.labId}</span> */}
                    <span className="text-gray-300">|</span>
                    <span className="font-medium text-gray-700">{labData.totalScore} Points</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Section (Full Width) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-3">
                <div className="w-1 h-5 bg-red-500 rounded-full"></div>
                <h3 className="text-base font-bold text-gray-800">Problem Description</h3>
            </div>
            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed text-sm">
                {labData.detail || "No details provided."}
            </p>

            {/* Test Cases Table (Inside Details) */}
            {labData.testCases.length > 0 && (
                <div className="mt-6 border rounded-xl overflow-hidden border-gray-100">
                    <div className="px-4 py-3 bg-gray-50/50 text-xs font-semibold text-gray-500 border-b border-gray-100 uppercase tracking-wider">
                        Test Cases Reference
                    </div>
                    <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-white">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">No.</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Input</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Output</th>
                                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Score</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {labData.testCases.map((tc, index) => (
                                <tr key={index}>
                                    <td className="px-4 py-2 text-xs text-gray-500">{tc.no}</td>
                                    <td className="px-4 py-2 text-xs font-mono text-gray-700 bg-gray-50/30">{tc.input}</td>
                                    <td className="px-4 py-2 text-xs font-mono text-blue-600">{tc.output}</td>
                                    <td className="px-4 py-2 text-xs text-center font-bold text-gray-900">{tc.score}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            )}
          </div>

          {/* Student Submissions Table (Full Width) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
            
            {/* Toolbar */}
            <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-red-500 transition-colors">
                            <FaFilter />
                        </div>
                        <select
                          className="pl-10 pr-10 py-2.5 text-sm border-gray-200 bg-gray-50 rounded-xl text-gray-700 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all cursor-pointer hover:bg-gray-100 hover:border-gray-300 border w-full sm:w-48 appearance-none"
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                        >
                          {filterOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                           <FaChevronDown size={10} />
                        </div>
                    </div>
                    <div className="h-8 w-[1px] bg-gray-200 hidden sm:block"></div>
                    <div className="text-sm text-gray-500 font-medium hidden sm:block">
                        Total: <span className="text-gray-900">{filteredStudents.length}</span>
                    </div>
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                    <button
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                        ${selectedCount > 0
                            ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 shadow-sm"
                            : "bg-gray-50 text-gray-300 border border-transparent cursor-not-allowed"
                        }`}
                        onClick={handleRejectAll}
                        disabled={selectedCount === 0}
                    >
                        <FaTimes size={14} /> Reject ({selectedCount})
                    </button>

                    <button
                        className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-sm
                        ${selectedCount > 0
                            ? "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md hover:-translate-y-0.5"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                        onClick={handleSubmitAll}
                        disabled={selectedCount === 0}
                    >
                        <FaCheck size={14} /> Pass ({selectedCount})
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left w-14">
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer transition-colors"
                                checked={isAllChecked}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                            />
                        </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[200px]">Student Info</th>
                    {labData.testCases.map((tc, idx) => (
                         <th key={idx} className="px-2 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider w-16">
                            <span className="block" title={`Input: ${tc.input}`}>TC{tc.no}</span>
                         </th>
                    ))}
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Score</th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredStudents.length === 0 ? (
                      <tr><td colSpan={10} className="px-6 py-16 text-center text-gray-400 italic bg-gray-50/30">No students found matching your filter.</td></tr>
                  ) : (
                      filteredStudents.map((student, index) => {
                        const originalIndex = students.findIndex((s) => s.studentId === student.studentId);
                        return (
                          <tr key={student.studentId} className={`group hover:bg-gray-50 transition-colors duration-150 ${student.selected ? 'bg-red-50/40' : ''}`}>
                            <td className="px-6 py-4 whitespace-nowrap align-middle">
                              <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                checked={student.selected}
                                onChange={() => handleSelectStudent(originalIndex)}
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap align-middle">
                                {renderStatusBadge(student.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap align-middle">
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-gray-900">{student.name}</span>
                                    {/* <span className="text-xs text-gray-400 font-mono mt-0.5">{student.studentId}</span> */}
                                </div>
                            </td>
                            
                            {/* Dynamic Test Case Columns */}
                            {labData.testCases.map((_, idx) => {
                                const res = student.results[idx];
                                const isPass = res?.status === "PASS" || res?.status === "CONFIRMED";
                                const isFail = res?.status === "FAIL" || res?.status === "REJECTED";
                                
                                return (
                                    <td key={idx} className="px-2 py-4 whitespace-nowrap text-center align-middle">
                                        <div className="flex justify-center">
                                            {isPass ? (
                                                <IoCheckmarkCircle className="text-emerald-500 text-xl" />
                                            ) : isFail ? (
                                                <IoCloseCircle className="text-red-400 text-xl" />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex items-center justify-center">
                                                    <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                );
                            })}
                            
                            <td className="px-6 py-4 whitespace-nowrap text-right align-middle">
                                <div className="inline-flex items-baseline gap-1">
                                    <span className={`font-bold text-base ${student.score === student.maxScore ? 'text-emerald-600' : 'text-gray-900'}`}>
                                        {student.score}
                                    </span>
                                    <span className="text-gray-400 text-xs font-medium">/ {student.maxScore}</span>
                                </div>
                            </td>
                            
                            <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                              <button 
                                onClick={() => handleViewStudent(student.submissionId)}
                                disabled={!student.submissionId}
                                className={`text-xs px-4 py-2 rounded-lg font-medium transition-all border ${
                                    student.submissionId 
                                    ? "border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 bg-white shadow-sm" 
                                    : "border-transparent text-gray-300 bg-gray-50 cursor-not-allowed"
                                }`}
                              >
                                Review
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 text-xs text-gray-500 flex justify-between items-center">
                <span>Showing <span className="font-semibold text-gray-700">{filteredStudents.length}</span> students</span>
                <span className={`${selectedCount > 0 ? 'text-red-600 font-medium' : ''}`}>
                    {selectedCount > 0 ? `${selectedCount} selected` : 'No items selected'}
                </span>
            </div>
          </div>

{/* Configuration Section (Moved to Bottom) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-10"> {/* เพิ่ม mb-10 ให้มีระยะห่างจากขอบล่างจอ */}
               <div className="flex items-center gap-2 mb-6 border-b border-gray-50 pb-3">
                    <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
                    <h2 className="text-lg font-bold text-gray-800">Configuration</h2>
               </div>
               <SymbolSection labData={labData} />
          </div>

        </div>
      </div>
    </div>
  );
}

export default LabInClass;