"use client";
import React, { useState } from "react";
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ClassCard from './_components/ClassCard';
import ClassCard_Other from './_components/ClassCard_Other';
import CreateClassModal from "./_components/CreateClassModal";
import Link from "next/link";
// Type definitions
export type ClassItem = {
  code: string;
  teacher: string;
  due: string;
  problem: string;
};

function Myclass() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [classes, setClasses] = useState<ClassItem[]>([
    { code: 'OOP-53', teacher: 'Chanapon Nitiwirot', due: 'Due Today', problem: 'ปัญหา: การออกแบบซอฟต์แวร์' },
    { code: 'OOD-53-1', teacher: 'Chanapon Nitiwirot', due: 'Due May 7, 11:59 PM', problem: 'ปัญหา: การออกแบบซอฟต์แวร์ขั้นสูง' },
    { code: 'OOD-53-2', teacher: 'Chanapon Nitiwirot', due: 'Due May 7, 11:59 PM', problem: 'ปัญหา: การออกแบบซอฟต์แวร์ขั้นสูง' },
    { code: 'OOD-53-3', teacher: 'Chanapon Nitiwirot', due: 'Due May 7, 11:59 PM', problem: 'ปัญหา: การออกแบบซอฟต์แวร์ขั้นสูง' },
  ]);
  const [classes1, setClasses1] = useState<ClassItem[]>([
    { code: 'MAD-53', teacher: 'Warangkana Seep', due: 'Due Today', problem: 'ปัญหา: การพัฒนาแอปพลิเคชันมือถือ' },
  ]);
  const [formData, setFormData] = useState({
    className: '',
    section: '',
    room: '',
  });

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ className: '', section: '', room: '' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateClass = () => {
    const { className, section, room } = formData;
    if (className && section && room) {
      const newClass: ClassItem = {
        code: `${className}-${section}`,
        teacher: 'Unknown Teacher',
        due: 'Due Today',
        problem: `ปัญหา: ${className}`,
      };
      setClasses((prev) => [...prev, newClass]);
      closeModal();
    } else {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <Navbar />
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col p-20">
          <div className="flex justify-end">
            <button
              onClick={openModal}
              className="bg-[#0D3ACE] text-white px-4 py-2 rounded-lg flex items-center hover:bg-[#0B2EA6] hover:shadow-lg transition-all duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
              </svg>
              Create Class
            </button>
          </div>

          <h2 className="text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-4">My Class</h2>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.length === 0 ? (
                <p className="text-gray-500">You don't have any classes yet.</p>
              ) : (
                classes.map((classItem, index) => (
                  <Link href="/Classwork" key={index}>
                    <ClassCard {...classItem} />
                  </Link>
                ))
              )}
            </div>

          <h2 className="text-4xl font-semibold border-b-2 border-gray-300 pb-1 mt-8 mb-4">Class</h2>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes1.length === 0 ? (
              <p className="text-gray-500">No other classes available.</p>
            ) : (
              classes1.map((classItem, index) => (
                <ClassCard_Other key={index} {...classItem} />
              ))
            )}
          </div>
        </div>
      </div>

      <CreateClassModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onCreate={handleCreateClass}
        formData={formData}
        setFormData={setFormData}
      />
    </div>
  );
}

export default Myclass;