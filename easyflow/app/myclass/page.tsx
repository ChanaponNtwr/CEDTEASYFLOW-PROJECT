"use client";
import React, { useState, useEffect } from "react";
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ClassCard from './_components/ClassCard';
import ClassCard_Other from './_components/ClassCard_Other';
import CreateClassModal from "./_components/CreateClassModal";
import Link from "next/link";
import { apiCreateClass, apiGetClasses } from "@/app/service/FlowchartService";
import { useSession } from "next-auth/react"; // ✅ Import useSession

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

  // ✅ 1. ดึงข้อมูล User จาก Session
  const { data: session, status } = useSession();
  
  // แปลง ID เป็น Number (หรือใช้ String ตาม Database คุณ)
  const currentUserId = session?.user 
    ? Number((session.user as any).id || (session.user as any).userId) 
    : null;

  // Form states
  const [formData, setFormData] = useState({
    className: '',
    section: '',
    room: '',
  });

  // ✅ 2. โหลดข้อมูลเมื่อได้ User ID แล้ว
  useEffect(() => {
    // ถ้ายังโหลด Session ไม่เสร็จ หรือไม่มี User ให้หยุดรอ
    if (status === "loading" || !currentUserId) return;

    apiGetClasses().then((res: any) => {
      if (res.ok && Array.isArray(res.classes)) {
        
        const ownedList: ClassItem[] = [];
        const joinedList: ClassItem[] = [];

        res.classes.forEach((c: any) => {
          // -----------------------------------------------------
          // 🔍 Logic หาชื่อ Teacher (แบบละเอียด)
          // -----------------------------------------------------
          
          // 1. หา User ที่มี Role เป็น Owner/Teacher/Creator
          let ownerEntry = c.userClasses?.find((uc: any) => {
            const r = uc.role?.roleName?.toLowerCase() || '';
            return r === 'owner' || r === 'teacher' || r === 'creator';
          });

          let teacherName = 'Unknown Teacher';

          // กรณี A: API ส่งข้อมูล User มาครบ
          if (ownerEntry?.user) {
            const u = ownerEntry.user;
            teacherName = u.name || (u.fname ? `${u.fname} ${u.lname || ''}`.trim() : 'Unknown Name');
          }
          // กรณี B: ข้อมูล User ไม่มา แต่ userId ตรงกับเรา -> ใช้ชื่อจาก Session เราเลย
          else if (ownerEntry && Number(ownerEntry.userId) === currentUserId) {
            teacherName = session?.user?.name || 'Me';
          }
          // กรณี C: ไม่เจอ Owner ใน List แต่เราคือคนสร้าง (เช็คจาก myEntry)
          else {
             const myEntry = c.userClasses?.find((uc: any) => Number(uc.userId) === currentUserId);
             if (myEntry?.role?.roleName?.toLowerCase() === 'owner') {
                teacherName = session?.user?.name || 'Me';
             }
          }

          // -----------------------------------------------------

          const createdDate = c.createAt ? new Date(c.createAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
          
          const classObj: ClassItem = {
            id: c.classId ?? c.id ?? Math.random().toString(36).slice(2,9),
            code: c.classname ?? c.name ?? 'Unnamed',
            teacher: teacherName, 
            due: `Created ${createdDate}`,
            problem: c.classname ?? '',
          };

          // แยก Class ของเรา vs Class ที่ไป Join
          const myUserClassEntry = c.userClasses?.find((uc: any) => Number(uc.userId) === currentUserId);
          const myRole = myUserClassEntry?.role?.roleName?.toLowerCase();
          
          if (myRole === 'owner' || myRole === 'teacher' || myRole === 'creator') {
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
  }, [currentUserId, status, session]); // ✅ ใส่ dependencies ให้ครบ

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
        // ✅ Optimistic Update: แสดงผลทันทีโดยใช้ชื่อจาก Session
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

  // แสดง Loading ระหว่างรอ Session
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
                  <Link href={`/classes/${encodeURIComponent(String(classItem.id))}`} key={index}>
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