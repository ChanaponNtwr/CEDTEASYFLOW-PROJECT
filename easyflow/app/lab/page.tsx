"use client"; // ระบุว่าเป็น client component สำหรับ Next.js App Router

import React, { useState } from "react";
import { FaFileAlt, FaExternalLinkAlt, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

// กำหนดประเภทสำหรับ submission
interface Submission {
  studentID: string;
  name: string;
  score: string;
}

// กำหนดประเภทสำหรับ testcase
interface Testcase {
  no: number;
  input: string;
  output: number;
  score: number;
  status: boolean;
}

function Lab() {
  // State สำหรับ submissions
  const [submissions] = useState<Submission[]>([
    { studentID: "66015445", name: "Zaire Geidt", score: "8/11" },
    { studentID: "66015555", name: "Gretchen Madsen", score: "8/11" },
    { studentID: "66015244", name: "Zain Botosh", score: "8/11" },
    { studentID: "66015355", name: "Ahmad Schiefer", score: "8/11" },
  ]);

  // State สำหรับการเปิด/ปิด Modal และข้อมูลนักเรียนที่เลือก
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);

  // ข้อมูล Testcase (สมมติข้อมูล)
  const testcases: Testcase[] = [
    { no: 1, input: "x", output: 10, score: 4, status: true },
    { no: 2, input: "b", output: 20, score: 4, status: true },
    { no: 3, input: "y", output: 30, score: 0, status: false },
  ];

  // Handler สำหรับปุ่ม Edit และไอคอน ↗️
  const handleEditClick = (studentID: string) => {
    const submission = submissions.find((s) => s.studentID === studentID);
    if (submission) {
      setSelectedSubmission(submission);
      setIsModalOpen(true);
    }
  };

  // Handler สำหรับปิด Modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSubmission(null);
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <Navbar />
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col p-6 md:p-20">
          {/* Buttons (Edit) */}
          <div className="flex justify-end space-x-4 mb-6">
            <button
              onClick={() => handleEditClick("all")}
              className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center hover:bg-blue-700"
              aria-label="Edit all submissions"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit
            </button>
          </div>

          {/* Title and Points with Icon */}
          <div className="flex justify-between items-center border-b-2 border-gray-300 pb-1 mb-6">
            <div className="flex items-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mr-4">
                <FaFileAlt className="w-14 h-14 text-gray-500" />
              </div>
              <h2 className="text-4xl font-semibold">
                Lab 3 <span className="text-xs align-top">(11 points)</span>
              </h2>
            </div>
            <p className="text-gray-500 text-sm">Due Mar 4, 2024, 11:59 PM</p>
          </div>

          {/* Wrapper to shift Description and Table */}
          <div className="ml-0 md:ml-10">
            {/* Description */}
            <p className="mb-6 text-gray-700">
              รายวิชาการเขียนโปรแกรมคอมพิวเตอร์ 1 คะแนนเก็บ ครั้งที่ 1 ทำ N ครั้งตามที่กำหนด
              <br />
              คำสั่ง: ทำตามขั้นตอนใน N ครั้งตามที่กำหนดให้ครบถ้วน
            </p>
            <div className="border-b-2 border-gray-300 pb-1 mb-6"></div>

            {/* Table of Submissions */}
            <table className="w-full bg-white shadow-md rounded-lg">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 text-left text-gray-700">No</th>
                  <th className="p-2 text-left text-gray-700">StudentID</th>
                  <th className="p-2 text-left text-gray-700">Name</th>
                  <th className="p-2 text-left text-gray-700">Score</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission, index) => (
                  <tr key={submission.studentID} className="hover:bg-gray-50">
                    <td className="p-2">{index + 1}</td>
                    <td className="p-2">{submission.studentID}</td>
                    <td className="p-2">{submission.name}</td>
                    <td className="p-2 flex items-center">
                      {submission.score}
                      <button
                        onClick={() => handleEditClick(submission.studentID)}
                        className="ml-2 text-gray-500 hover:text-gray-700"
                        aria-label={`Edit score for ${submission.name}`}
                      >
                        <FaExternalLinkAlt />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && selectedSubmission && (
          <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-md flex items-center justify-center z-[1000]">
            <div className="bg-white p-6 rounded-lg shadow-lg w-96">
              <h2 className="text-xl font-semibold mb-4">Score per Testcase</h2>
              <p className="mb-2">
                {selectedSubmission.name} ({selectedSubmission.studentID}@kmitl.ac.th)
              </p>
              <table className="w-full mb-4">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left text-gray-700">No</th>
                    <th className="p-2 text-left text-gray-700">Input</th>
                    <th className="p-2 text-left text-gray-700">Output</th>
                    <th className="p-2 text-left text-gray-700">Score</th>
                    <th className="p-2 text-left text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {testcases.map((testcase) => (
                    <tr key={testcase.no} className="hover:bg-gray-50">
                      <td className="p-2">{testcase.no}</td>
                      <td className="p-2">{testcase.input}</td>
                      <td className="p-2">{testcase.output}</td>
                      <td className="p-2">{testcase.score}</td>
                      <td className="p-2">
                        {testcase.status ? (
                          <FaCheckCircle className="text-green-500" />
                        ) : (
                          <FaTimesCircle className="text-red-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-center">
                <button
                  onClick={handleCloseModal}
                  className="bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Lab;