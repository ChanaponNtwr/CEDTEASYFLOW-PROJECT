"use client";
import React, { useState } from "react";
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ClassCard from './_components/ClassCard';
import ClassCard_Other from './_components/ClassCard_Other';
import CreateClassModal from "./_components/CreateClassModal";
import Link from "next/link";
import { apiCreateClass, apiGetClasses } from "@/app/service/FlowchartService";

export type ClassItem = {
  id: number | string;
  code: string;
  teacher: string;
  due: string;
  problem: string;
};

function Myclass() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // 1. แยก State สำหรับ Class ที่เราสร้าง (Owner) และ Class ที่เราเรียน (Student)
  const [myClasses, setMyClasses] = useState<ClassItem[]>([]);
  const [joinedClasses, setJoinedClasses] = useState<ClassItem[]>([]);

  // สมมติว่า userId ปัจจุบันคือ 3 (ควรดึงจาก Auth Context หรือ Token ของจริง)
  const currentUserId = 3; 

  React.useEffect(() => {
    apiGetClasses().then((res: any) => {
      if (res.ok && Array.isArray(res.classes)) {
        
        const ownedList: ClassItem[] = [];
        const joinedList: ClassItem[] = [];

        res.classes.forEach((c: any) => {
          // หาข้อมูลเจ้าของห้อง (Owner) เพื่อนำมาแสดงชื่อ Teacher
          const ownerEntry = c.userClasses?.find((uc: any) => uc.role?.roleName === 'owner');
          const teacherName = ownerEntry?.user?.name ?? 'Unknown Teacher';
          
          // สร้าง Object ข้อมูล Class
          const createdDate = c.createAt ? new Date(c.createAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
          const classObj: ClassItem = {
            id: c.classId ?? c.id ?? Math.random().toString(36).slice(2,9),
            code: c.classname ?? c.name ?? 'Unnamed',
            teacher: teacherName,
            due: `Created ${createdDate}`,
            problem: c.classname ?? '',
          };

          // 2. ตรวจสอบ Role ของ User ปัจจุบันใน Class นั้นๆ เพื่อแยก List
          // ค้นหา userClass ของ "เรา" (currentUserId)
          const myUserClassEntry = c.userClasses?.find((uc: any) => uc.userId === currentUserId);
          
          // ถ้าไม่มีข้อมูลเราใน userClasses ให้ลองเช็คว่าเป็นคนสร้างหรือไม่ (Fallback logic)
          // หรือถ้า roleName เป็น owner ให้เข้า My Class
          if (myUserClassEntry?.role?.roleName === 'owner') {
            ownedList.push(classObj);
          } else {
            // กรณีอื่นๆ (student, member) หรือหาไม่เจอแต่มัน return มาใน list ให้ถือว่าเป็น joined
            joinedList.push(classObj);
          }
        });

        setMyClasses(ownedList);
        setJoinedClasses(joinedList);

      } else {
        setMyClasses([]);
        setJoinedClasses([]);
      }
    }).catch(err => console.error("Failed to fetch classes:", err));
  }, []);

  // Form states
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

  const handleCreateClass = async () => {
    const { className, section, room } = formData;
    if (!className || !section || !room) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const labname = `${className} ${section}`;
    const payload = {
      classname: labname,
      testcases: [],
      currentUserId: currentUserId, // ใช้ตัวแปรเดียวกัน
      meta: { room },
    };

    setIsCreating(true);
    try {
      const result = await apiCreateClass(payload);
      if (result?.ok) {
        const newClass: ClassItem = {
          id: result.class.classId ?? result.class.id ?? Math.random().toString(36).slice(2,9),
          code: `${className}-${section}`,
          teacher: 'You',
          due: 'Due Today',
          problem: `ปัญหา: ${labname}`,
        };
        // อัปเดต list ของ My Class
        setMyClasses((prev) => [...prev, newClass]);
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
    <div className="pt-20 min-h-screen ">
      <div className="pl-60">
        <Navbar />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 flex flex-col p-20">
            
            {/* Create Button Section */}
            <div className="flex justify-end mb-6">
              <button onClick={openModal} className="bg-[#0D3ACE] text-white px-4 py-2 rounded-lg flex items-center hover:bg-[#0B2EA6] hover:shadow-lg transition-all duration-200">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Create Class
              </button>
            </div>

            {/* --- Section 1: My Class (Owned) --- */}
            <h2 className="text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-4">My Class</h2>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myClasses.length === 0 ? (
                <p className="text-gray-500">You haven't created any classes yet.</p>
              ) : (
                myClasses.map((classItem, index) => (
                  <Link href={`/classes/${encodeURIComponent(String(classItem.id))}`} key={index}>
                    <ClassCard {...classItem} />
                  </Link>
                ))
              )}
            </div>

            {/* --- Section 2: Class (Joined / Student) --- */}
            <h2 className="text-4xl font-semibold border-b-2 border-gray-300 pb-1 mt-8 mb-4">Joined Class</h2>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {joinedClasses.length === 0 ? (
                <p className="text-gray-500">No joined classes available.</p>
              ) : (
                joinedClasses.map((classItem, index) => (
                   // ลิงก์ไปยังหน้าของนักเรียน (ปรับ path ตามจริง)
                  <Link href={`/classes/${encodeURIComponent(String(classItem.id))}`} key={index}>
                    {/* ใช้ ClassCard_Other ตามที่ต้องการ */}
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
          isCreating={isCreating}
        />
      </div>
    </div>
  );
}

export default Myclass;