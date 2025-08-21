"use client"; // ระบุว่าเป็น client component สำหรับ Next.js App Router

import React, { useState } from "react";

import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Tabs from "./_components/Tabs";
import ClassHeader from "./_components/ClassHeader";
import FilterActions from "./_components/FilterActions";
import AssignmentItem from "./_components/AssignmentItem";

function Classstudent() {
  const [activeTab, setActiveTab] = useState<string>("Classwork");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const assignments = [
    {
      title: "Lab 2: ปัญหา: การออกแบบซอฟต์แวร์ขั้นสูง",
      due: "Due Mar 1, 11:59 PM",
    },
    {
      title: "Lab 1: ปัญหา: การออกแบบซอฟต์แวร์",
      due: "Due Today",
    },
  ];

  const handleCreateClick = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleAddClick = () => {
    console.log("Add button clicked");
    // เพิ่ม logic สำหรับการกดปุ่ม "+"
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <Navbar />
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col p-20">
          {/* Tabs */}
          <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Class Header */}
          <ClassHeader
            code="OOP-53"
            teacher="Chanapon Nitiwirot"
            schedule="9:00-12:00(อ.) - 13:00-15:00(พ.)"
            backgroundImage="/images/classroom.jpg" // ใช้ local image หรือ remote URL ที่กำหนดใน next.config.js
          />

          {/* Filter and Create Buttons */}
          <FilterActions onCreateClick={handleCreateClick} />

          {/* Assignments List */}
          <div className="space-y-4">
            {assignments.map((assignment, index) => (
              <AssignmentItem
                key={index}
                title={assignment.title}
                due={assignment.due}
                onEditClick={() => console.log(`Edit assignment: ${assignment.title}`)} // เพิ่ม handler สำหรับ Edit
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Classstudent;