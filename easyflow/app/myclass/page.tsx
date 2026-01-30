// app/.../Myclass.tsx (ไฟล์เต็มที่แก้แล้ว)
"use client";
import React, { useState, useEffect } from "react";
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import ClassCard from './_components/ClassCard';
import ClassCard_Other from './_components/ClassCard_Other';
import CreateClassModal from "./_components/CreateClassModal";
import Link from "next/link";
import { apiCreateClass, apiGetClasses, apiDeleteClass } from "@/app/service/FlowchartService";
import { useSession } from "next-auth/react";

export type ClassItem = {
  id: number | string;
  code: string;
  teacher: string;
  due: string;
  problem: string;

  // ✅ เพิ่ม flag ว่าเป็น Owner ไหม
  isOwner: boolean;
};

function Myclass() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [myClasses, setMyClasses] = useState<ClassItem[]>([]);
  const [joinedClasses, setJoinedClasses] = useState<ClassItem[]>([]);

  const { data: session, status } = useSession();
  
  const currentUserId = session?.user 
    ? Number((session.user as any).id || (session.user as any).userId) 
    : null;

  const [formData, setFormData] = useState({
    className: '',
    section: '',
    room: '',
  });

  // ================= โหลดข้อมูล =================
  const loadClasses = async () => {
    if (!currentUserId) return;

    try {
      const res: any = await apiGetClasses();

      if (res.ok && Array.isArray(res.classes)) {
        const ownedList: ClassItem[] = [];
        const joinedList: ClassItem[] = [];

        res.classes.forEach((c: any) => {
          const myUserClassEntry = c.userClasses?.find(
            (uc: any) => Number(uc.userId) === currentUserId
          );
          if (!myUserClassEntry) return;

          let teacherName = '';

          const ownerEntry = c.userClasses?.find((uc: any) => {
            const r = uc.role?.roleName?.toLowerCase() || '';
            return ['owner', 'teacher', 'creator'].includes(r);
          });

          if (ownerEntry && Number(ownerEntry.userId) === currentUserId) {
            teacherName = session?.user?.name || 'Me';
          } else if (ownerEntry && ownerEntry.user) {
            const u = ownerEntry.user;
            teacherName =
              u.name ||
              (u.fname ? `${u.fname} ${u.lname || ''}`.trim() : null) ||
              u.username ||
              u.email;
          } else if (c.owner && c.owner.name) {
            teacherName = c.owner.name;
          } else if (c.teacher && c.teacher.name) {
            teacherName = c.teacher.name;
          }

          if (!teacherName) {
            if (ownerEntry?.userId) {
              teacherName = `Teacher (ID: ${ownerEntry.userId})`;
            } else {
              teacherName = 'Unknown Teacher';
            }
          }

          const createdDate = c.createAt
            ? new Date(c.createAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            : '';

          const myRole = myUserClassEntry.role?.roleName?.toLowerCase();

          // ✅ เช็ค Owner จริงเท่านั้น
          const isOwner = myRole === 'owner';

          const classObj: ClassItem = {
            id: c.classId ?? c.id,
            code: c.classname ?? c.name ?? 'Unnamed',
            teacher: teacherName,
            due: `Created ${createdDate}`,
            problem: c.classname ?? '',
            isOwner,
          };

          // My Class = Owner + Teacher
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
    } catch (err) {
      console.error("Failed to fetch classes:", err);
    }
  };

  useEffect(() => {
    if (status === "loading" || !currentUserId) return;
    loadClasses();
  }, [currentUserId, status, session]);

  // ================= Delete Class (Owner เท่านั้น) =================
  const handleDeleteClass = async (classId: string | number) => {
    if (!currentUserId) {
      alert("ไม่พบข้อมูลผู้ใช้ กรุณา Login ใหม่");
      return;
    }

    const confirmed = confirm(
      "คุณต้องการลบ Class นี้ถาวรใช่หรือไม่?\nการกระทำนี้ไม่สามารถย้อนกลับได้"
    );
    if (!confirmed) return;

    try {
      await apiDeleteClass(classId, currentUserId);

      setMyClasses((prev) =>
        prev.filter((c) => String(c.id) !== String(classId))
      );
    } catch (err: any) {
      console.error("Delete class failed:", err);
      alert(err?.message || "ลบ Class ไม่สำเร็จ");
    }
  };

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
        const newClass: ClassItem = {
          id: result.class?.classId ?? result.class?.id,
          code: `${className}-${section}`,
          teacher: session?.user?.name || 'You',
          due: 'Just now',
          problem: `ปัญหา: ${labname}`,
          isOwner: true, // ✅ คนสร้าง = Owner
        };

        // ===============================
        // เปลี่ยนจาก append -> prepend
        // เพื่อให้ class ใหม่อยู่บนสุด (ไม่กระทบ UI)
        // ===============================
        setMyClasses((prev) => [newClass, ...prev]);

        closeModal();
      } else {
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
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading user session...
      </div>
    );
  }

  return (
    <div className="pt-20 min-h-screen ">
      <div className="pl-60">
        <Navbar />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 flex flex-col p-20">
            
            {/* Create Class */}
            <div className="flex justify-end mb-6">
              <button
                onClick={openModal}
                className="bg-[#0D3ACE] text-white px-4 py-2 rounded-lg flex items-center hover:bg-[#0B2EA6] hover:shadow-lg transition-all duration-200 cursor-pointer"
              >
                Create Class
              </button>
            </div>

            {/* My Class */}
            <h2 className="text-4xl font-semibold border-b-2 border-gray-300 pb-1 mb-4">
              My Class
            </h2>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myClasses.length === 0 ? (
                <p className="text-gray-500">You haven't created any classes yet.</p>
              ) : (
                myClasses.map((classItem, index) => (
                  <Link
                    href={`/classes/${encodeURIComponent(String(classItem.id))}`}
                    key={`my-${index}`}
                  >
                    <ClassCard
                      {...classItem}
                      // ✅ ส่งปุ่มลบเฉพาะ Owner เท่านั้น
                      onDeleteClick={
                        classItem.isOwner
                          ? () => handleDeleteClass(classItem.id)
                          : undefined
                      }
                    />
                  </Link>
                ))
              )}
            </div>

            {/* Joined Class */}
            <h2 className="text-4xl font-semibold border-b-2 border-gray-300 pb-1 mt-8 mb-4">
              Joined Class
            </h2>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {joinedClasses.length === 0 ? (
                <p className="text-gray-500">No joined classes available.</p>
              ) : (
                joinedClasses.map((classItem, index) => (
                  <Link
                    href={`/classes/${encodeURIComponent(String(classItem.id))}`}
                    key={`joined-${index}`}
                  >
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
