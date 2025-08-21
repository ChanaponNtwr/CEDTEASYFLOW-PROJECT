"use client";

import React, { useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Tabs from "./_components/Tabs";
import ClassHeader from "./_components/ClassHeader";
import FilterActions from "./_components/FilterActions";
import AssignmentItem from "./_components/AssignmentItem";
import ImportLabModal from "./_components/ImportLabModal";

function Classwork() {
  const [activeTab, setActiveTab] = useState<string>("Classwork");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  // เพิ่ม state สำหรับ formData
  const [formData, setFormData] = useState<{ labId: string; dueDate: string; dueTime: string }>({
    labId: "",
    dueDate: "",
    dueTime: "",
  });

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

  const handleCreateClick = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  const handleAddClick = () => console.log("Add button clicked");

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <div className="pl-60">
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
              backgroundImage="/images/classwork.png"
            />

            {/* Filter and Create Buttons */}
            <FilterActions onCreateClick={handleCreateClick} />

            {/* Assignments List */}
            <div className="space-y-4">
              {assignments.map((assignment, index) => (
                <Link href="/-" key={index}>
                  <AssignmentItem
                    title={assignment.title}
                    due={assignment.due}
                    onEditClick={() => console.log(`Edit assignment: ${assignment.title}`)}
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Component */}
        <ImportLabModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onAddClick={handleAddClick}
          formData={formData}
          setFormData={setFormData}
        />
      </div>
    </div>
  );
}

export default Classwork;