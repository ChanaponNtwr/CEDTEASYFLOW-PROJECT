"use client";
import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { FaFilter } from "react-icons/fa"; // เพิ่มไอคอน filter

function LabInClass() {
  const [students, setStudents] = useState([
    { name: "Zaire Geidt", status: "pending", score: 8, selected: false, testcase1: "", testcase2: "", testcase3: "" },
    { name: "Gretchen Madsen", status: "pending", score: 8, selected: false, testcase1: "", testcase2: "", testcase3: "" },
    { name: "Zain Botosh", status: "pending", score: 8, selected: false, testcase1: "", testcase2: "", testcase3: "" },
    { name: "Ahmad Schliefer", status: "pending", score: 8, selected: false, testcase1: "", testcase2: "", testcase3: "" },
  ]);

  const [filterStatus, setFilterStatus] = useState("All");

  // เลือกทั้งหมดใน view ปัจจุบัน
  const handleSelectAll = (checked: boolean) => {
    const updated = students.map((student) =>
      filterStatus === "All" || student.status === filterStatus
        ? { ...student, selected: checked }
        : student
    );
    setStudents(updated);
  };

  // toggle นักเรียนทีละคน
  const handleSelectStudent = (index: number) => {
    const updated = [...students];
    updated[index].selected = !updated[index].selected;
    setStudents(updated);
  };

  // ฟิลเตอร์นักเรียนตามสถานะ
  const filteredStudents =
    filterStatus === "All"
      ? students
      : students.filter((student) => student.status === filterStatus);

  // กด submit all → เปลี่ยนสถานะ selected = true เป็น Pass
  const handleSubmitAll = () => {
    const updated = students.map((student) =>
      student.selected
        ? { ...student, status: "Pass", selected: false }
        : student
    );
    setStudents(updated);
    alert("เปลี่ยนสถานะเป็น Pass ให้กับนักเรียนที่เลือกเรียบร้อย");
  };

  // เช็คว่า checkbox All ต้องถูกติ๊กไหม
  const isAllChecked =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => s.selected);

  return (
    <div className="min-h-screen w-full bg-gray-100">
      <div className="pt-20 pl-52">
        <Navbar />
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex justify-center p-6 md:p-10">
            <div className="w-full max-w-7xl bg-white p-6 rounded-lg shadow-md">
              {/* Header */}
              <div className="flex justify-between items-center border-b-2 border-gray-300 pb-1 mb-6 mt-4">
                <div className="flex items-center">
                  <div className="w-20 h-20 bg-[#EEEEEE] rounded-full flex items-center justify-center mr-4">
                    <img src="/images/lab.png" className="w-12 h-14" />
                  </div>
                  <h2 className="text-4xl font-semibold">
                    Lab 3 <span className="text-xs align-top">(11 points)</span>
                  </h2>
                </div>
                <p className="text-gray-500 text-sm">
                  Due MAR 4, 2024, 11:59 PM
                </p>
              </div>

              <div className="ml-0 md:ml-10">
                <p className="mb-6 text-gray-700">
                  รายวิชาการเขียนโปรแกรมคอมพิวเตอร์ 1 คะแนนเก็บ ครั้งที่ 1 ทำ N
                  ครั้งตามที่กำหนด
                  <br />
                  คำสั่ง: ทำตามขั้นตอนใน N ครั้งตามที่กำหนดให้ครบถ้วน
                </p>
                <div className="border-b-2 border-gray-300 pb-1 mb-6"></div>

                {/* Filter + Submit */}
                    <div className="flex justify-end gap-4 mb-6">
                      {/* Filter Dropdown */}
                      <div className="relative flex items-center">
                        <FaFilter className="absolute left-3 text-white text-sm pointer-events-none" />
                        <select
                          className="pl-8 pr-4 py-2 border rounded-full bg-[#B92627] text-white border-gray-400 appearance-none cursor-pointer"
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                        >
                          <option className="bg-white text-black" value="All">All</option>
                          <option className="bg-white text-black" value="Pass">Pass</option>
                          <option className="bg-white text-black" value="Fail">Fail</option>
                          <option className="bg-white text-black" value="pending">Pending</option>
                        </select>
                      </div>

                      {/* Submit Button */}
                      <button
                        className={`px-4 py-2 rounded-full cursor-pointer border transition 
                          ${students.some((s) => s.selected)
                            ? "bg-[#2E8B57] text-white border-green-600 hover:bg-[#267347]"
                            : "bg-white text-gray-500 border-gray-400 cursor-not-allowed"
                          }`}
                        onClick={handleSubmitAll}
                        disabled={!students.some((s) => s.selected)}
                      >
                        Submit All
                      </button>
                    </div>

                {/* Table */}
                <div className="flex-1 mb-6">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 text-left">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isAllChecked}
                              onChange={(e) =>
                                handleSelectAll(e.target.checked)
                              }
                            />
                            <span className="text-sm font-medium">All</span>
                          </div>
                        </th>
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
                      {filteredStudents.map((student) => {
                        const originalIndex = students.findIndex(
                          (s) => s.name === student.name
                        );
                        return (
                          <tr key={student.name} className="border-t">
                            <td className="px-4 py-2 pl-9">
                              <input
                                type="checkbox"
                                checked={student.selected}
                                onChange={() =>
                                  handleSelectStudent(originalIndex)
                                }
                              />
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={`px-2 py-1 rounded-full ${
                                  student.status === "Pass"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {student.status}
                              </span>
                            </td>
                            <td className="px-4 py-2">{student.name}</td>
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
                        );
                      })}
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
