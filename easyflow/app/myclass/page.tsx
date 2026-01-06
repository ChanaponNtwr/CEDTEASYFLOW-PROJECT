"use client";
import React, { useState } from "react";
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ClassCard from './_components/ClassCard';
import ClassCard_Other from './_components/ClassCard_Other';
import CreateClassModal from "./_components/CreateClassModal";
import Link from "next/link";
import { apiCreateClass, apiGetClasses } from "@/app/service/FlowchartService"; // <-- import api

// Type definitions
export type ClassItem = {
  id: number;
  code: string;
  teacher: string;
  due: string;
  problem: string;
};

function Myclass() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false); // loading state
  const [classes, setClasses] = useState<ClassItem[]>([]);

  // Fetch classes on mount
  React.useEffect(() => {
    apiGetClasses().then((res: any) => {
      if (res.ok && Array.isArray(res.classes)) {
        // Map backend data to frontend ClassItem
        const mapped = res.classes.map((c: any) => {
          console.log('API Class Object:', c); // Debug log
          // Find owner in userClasses
          const ownerEntry = c.userClasses?.find((uc: any) => uc.role?.roleName === 'owner');
          // If we have user data included, used it. Otherwise use placeholder.
          // Note: listClasses repo method includes userClasses->role, but maybe not user->name
          // actually listClassesForUser includes userClasses->role. userClasses doesn't usually include user unless specified.

          const createdDate = new Date(c.createAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric'
          });

          return {
            code: c.classname,
            teacher: ownerEntry ? 'Owner' : 'Unknown Teacher',
            due: `Created ${createdDate}`,     // Showing Created Date as requested "Due date" context is ambiguous for Class
            problem: c.classname
          };
        });
        setClasses(mapped);
      }
    }).catch(err => console.error("Failed to fetch classes:", err));
  }, []);

  const [classes1, setClasses1] = useState<ClassItem[]>([
    { id: 999, code: 'MAD-53', teacher: 'Warangkana Seep', due: 'Due Today', problem: 'ปัญหา: การพัฒนาแอปพลิเคชันมือถือ' },
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

  // Updated: handleCreateClass now calls backend API
  const handleCreateClass = async () => {
    const { className, section, room } = formData;
    if (!className || !section || !room) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    // prepare payload for API
    const labname = `${className} ${section}`;
    const payload = {
      classname: labname, // <<-- Change key to 'classname' (backend expects 'classname')

      testcases: [], // ถ้าต้องการสร้าง testcases เริ่มต้น ให้ใส่ที่นี่
      currentUserId: 3, // <-- เปลี่ยนเป็น user id จริงจาก auth ของคุณถ้ามี
      meta: { room }, // optional metadata
    };

    setIsCreating(true);
    try {
      const result = await apiCreateClass(payload);
      // result expected { ok: true, class: { classId, name, ownerId, lab: {...} } }
      if (result?.ok) {
        // Build a UI-friendly ClassItem and append to list
        const newClass: ClassItem = {
          id: result.class.classId, // Use real ID from result
          code: `${className}-${section}`,
          teacher: 'You', // หรือ ดึงชื่อจริงจากผลลัพธ์/ผู้ใช้ที่ล็อกอิน
          due: 'Due Today',
          problem: `ปัญหา: ${labname}`,
        };
        setClasses((prev) => [...prev, newClass]);
        closeModal();
        alert("Create class successful");
      } else {
        console.error("apiCreateClass returned not ok:", result);
        alert("Create failed");
      }
    } catch (err) {
      console.error("Create class error:", err);
      alert("Create failed — check console");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <div className="pl-60">
        <Navbar />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 flex flex-col p-20">
            <div className="flex justify-end mb-6">
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
                  <Link href={`/Classwork?id=${classItem.id || ''}`} key={index}>
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
                  <Link href="/Classstudent" key={index}>
                    <ClassCard_Other {...classItem} />
                  </Link>
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
          isCreating={isCreating} // pass loading if modal uses it
        />
      </div>
    </div>
  );
}

export default Myclass;
