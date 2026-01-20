"use client";
import React, { useState, useEffect } from "react";
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ClassCard from './_components/ClassCard';
import ClassCard_Other from './_components/ClassCard_Other';
import CreateClassModal from "./_components/CreateClassModal";
import Link from "next/link";
import { apiCreateClass, apiGetClasses } from "@/app/service/FlowchartService";
import { useSession } from "next-auth/react";

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
  
  const [myClasses, setMyClasses] = useState<ClassItem[]>([]);
  const [joinedClasses, setJoinedClasses] = useState<ClassItem[]>([]);

  // 1. ดึงข้อมูล User จาก Session
  const { data: session, status } = useSession();
  
  // ดึง ID ของ user ปัจจุบัน
  const currentUserId = session?.user 
    ? Number((session.user as any).id || (session.user as any).userId) 
    : null;

  // Form states
  const [formData, setFormData] = useState({
    className: '',
    section: '',
    room: '',
  });

 // ✅ 2. โหลดข้อมูล
  useEffect(() => {
    if (status === "loading" || !currentUserId) return;

    apiGetClasses().then((res: any) => {
      if (res.ok && Array.isArray(res.classes)) {
        
        const ownedList: ClassItem[] = [];
        const joinedList: ClassItem[] = [];

        res.classes.forEach((c: any) => {
          
          // --- หาข้อมูลของตัวเราใน Class นี้ ---
          const myUserClassEntry = c.userClasses?.find((uc: any) => Number(uc.userId) === currentUserId);
          if (!myUserClassEntry) return; // ถ้าไม่มีเราในคลาส ข้ามไป

          // -----------------------------------------------------
          // 🔍 Logic หาชื่อ Teacher (ฉลาดขึ้น)
          // -----------------------------------------------------
          let teacherName = '';

          // 1. หาคนที่เป็น Owner/Teacher ใน userClasses
          const ownerEntry = c.userClasses?.find((uc: any) => {
             const r = uc.role?.roleName?.toLowerCase() || '';
             return ['owner', 'teacher', 'creator'].includes(r);
          });

          // Step A: เช็คว่า Owner คือตัวเราเองหรือเปล่า?
          if (ownerEntry && Number(ownerEntry.userId) === currentUserId) {
             teacherName = session?.user?.name || 'Me';
          }
          // Step B: เช็คว่าใน ownerEntry มีข้อมูล user object ไหม?
          else if (ownerEntry && ownerEntry.user) {
             const u = ownerEntry.user;
             teacherName = u.name 
                || (u.fname ? `${u.fname} ${u.lname || ''}`.trim() : null)
                || u.username
                || u.email;
          }
          // Step C: เช็คที่ Root Object (เผื่อ Backend ส่ง c.owner หรือ c.teacher มา)
          else if (c.owner && c.owner.name) {
             teacherName = c.owner.name;
          }
          else if (c.teacher && c.teacher.name) {
             teacherName = c.teacher.name;
          }
          
          // Step D: ถ้ายังหาไม่เจอจริงๆ ให้ใช้ ID เป็นทางเลือกสุดท้าย
          if (!teacherName) {
             // เช็คว่า ownerEntry มีค่าไหม ถ้ามีเอา ID มาแสดง ดีกว่าขึ้น Unknown
             if (ownerEntry?.userId) {
                teacherName = `Teacher (ID: ${ownerEntry.userId})`;
             } else {
                teacherName = 'Unknown Teacher';
             }
          }

          // -----------------------------------------------------

          const createdDate = c.createAt ? new Date(c.createAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
          
          const classObj: ClassItem = {
            id: c.classId ?? c.id ?? Math.random().toString(36).slice(2,9),
            code: c.classname ?? c.name ?? 'Unnamed',
            teacher: teacherName, // ใช้ชื่อที่หามาได้
            due: `Created ${createdDate}`,
            problem: c.classname ?? '',
          };

          // --- แยก My Class vs Joined Class ---
          const myRole = myUserClassEntry.role?.roleName?.toLowerCase();
          
          if (['owner', 'teacher', 'creator'].includes(myRole)) {
            ownedList.push(classObj);
          } else {
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
  }, [currentUserId, status, session]);

  
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

    if (!currentUserId) {
      alert("ไม่พบข้อมูลผู้ใช้ กรุณา Login ใหม่");
      return;
    }

    const labname = `${className} ${section}`;
    const payload = {
      classname: labname,
      testcases: [],
      currentUserId: currentUserId,
      meta: { room },
    };

    setIsCreating(true);
    try {
      const result = await apiCreateClass(payload);
      if (result?.ok) {
        // Optimistic Update: เพิ่มเข้า My Class ทันที
        const newClass: ClassItem = {
          id: result.class?.classId ?? result.class?.id ?? Math.random().toString(36).slice(2,9),
          code: `${className}-${section}`,
          teacher: session?.user?.name || 'You', 
          due: 'Just now',
          problem: `ปัญหา: ${labname}`,
        };
        
        setMyClasses((prev) => [...prev, newClass]);
        closeModal();
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

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading user session...</div>;
  }

  return (
    <div className="pt-20 min-h-screen ">
      <div className="pl-60">
        <Navbar />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 flex flex-col p-20">
            
            {/* ปุ่ม Create Class */}
            <div className="flex justify-end mb-6">
              <button onClick={openModal} className="bg-[#0D3ACE] text-white px-4 py-2 rounded-lg flex items-center hover:bg-[#0B2EA6] hover:shadow-lg transition-all duration-200 cursor-pointer">
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
                  <Link href={`/classes/${encodeURIComponent(String(classItem.id))}`} key={`my-${index}`}>
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
                  <Link href={`/classes/${encodeURIComponent(String(classItem.id))}`} key={`joined-${index}`}>
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
        />
      </div>
    </div>
  );
}

export default Myclass;