"use client";
import React, { useState } from "react";
import { FaFileAlt } from "react-icons/fa";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Image from "next/image";

function LabInClass() {
  // State for student data
  const [students] = useState([
    { name: "Zaire Geidt", status: "Pass", score: 8, testcase1: "", testcase2: "", testcase3: "" },
    { name: "Gretchen Madsen", status: "Fail", score: 8, testcase1: "", testcase2: "", testcase3: "" },
    { name: "Zain Botosh", status: "pending", score: 8, testcase1: "", testcase2: "", testcase3: "" },
    { name: "Ahmad Schliefer", status: "Pass", score: 8, testcase1: "", testcase2: "", testcase3: "" },
  ]);

  return (
    <div className="min-h-screen w-full bg-gray-100">
      <div className="pt-20 pl-52">
        <Navbar />
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex justify-center p-6 md:p-10">
            <div className="w-full max-w-7xl bg-white p-6 rounded-lg shadow-md">
              {/* Title and Points */}
              <div className="flex justify-between items-center border-b-2 border-gray-300 pb-1 mb-6 mt-4">
                <div className="flex items-center">
                  <div className="w-20 h-20 bg-[#EEEEEE] rounded-full flex items-center justify-center mr-4">
                    <img src="/images/lab.png" className="w-12 h-14" />
                  </div>
                  <h2 className="text-4xl font-semibold">
                    Lab 3 <span className="text-xs align-top">(11 points)</span>
                  </h2>
                </div>
                <p className="text-gray-500 text-sm">Due MAR 4, 2024, 11:59 PM</p>
              </div>

              {/* Description */}
              <div className="ml-0 md:ml-10">
                <p className="mb-6 text-gray-700">
                  รายวิชาการเขียนโปรแกรมคอมพิวเตอร์ 1 คะแนนเก็บ ครั้งที่ 1 ทำ N
                  ครั้งตามที่กำหนด
                  <br />
                  คำสั่ง: ทำตามขั้นตอนใน N ครั้งตามที่กำหนดให้ครบถ้วน
                </p>
                <div className="border-b-2 border-gray-300 pb-1 mb-6"></div>

                {/* Student Table */}
                <div className="flex-1 mb-6">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Testcase 1</th>
                        <th className="px-4 py-2 text-left">Testcase 2</th>
                        <th className="px-4 py-2 text-left">Testcase 3</th>
                        <th className="px-4 py-2 text-left">Score</th>
                        <th className="px-4 py-2 text-left">Flowchart</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-4 py-2">
                            <span
                              className={`px-2 py-1 rounded-full ${
                                student.status === "Pass"
                                  ? "bg-green-100 text-green-800"
                                  : student.status === "Fail"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {student.status}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                          </td>
                          <td className="px-4 py-2">{student.testcase1}</td>
                          <td className="px-4 py-2">{student.testcase2}</td>
                          <td className="px-4 py-2">{student.testcase3}</td>
                          <td className="px-4 py-2">{student.score}/11</td>
                          <td className="px-4 py-2">
                            <button className="px-4 py-2 bg-[#0D3ACE] hover:bg-blue-700 text-white rounded-full cursor-pointer">
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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