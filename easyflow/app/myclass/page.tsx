// app/.../Myclass.tsx
"use client";
import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import ClassCard from "./_components/ClassCard";
import ClassCard_Other from "./_components/ClassCard_Other";
import CreateClassModal from "./_components/CreateClassModal";
import Link from "next/link";
import {
  apiCreateClass,
  apiGetClasses,
  apiDeleteClass,
} from "@/app/service/FlowchartService";
import { useSession } from "next-auth/react";
import { BookOpen } from "lucide-react";

export type ClassItem = {
  id: number | string;
  code: string;
  teacher: string;
  due: string;
  problem: string;
  isOwner: boolean;
};

// ✅ ฟังก์ชันสุ่มรูปภาพที่ดูสุภาพ (Personas Style)
// ใช้ชื่อ teacher เป็น seed เพื่อให้ได้รูปเดิมเสมอสำหรับคนเดิม
const getAvatarUrl = (name: string) => {
  return `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(
    name
  )}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;
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
    className: "",
    section: "",
    room: "",
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

          let teacherName = "";

          const ownerEntry = c.userClasses?.find((uc: any) => {
            const r = uc.role?.roleName?.toLowerCase() || "";
            return ["owner", "teacher", "creator"].includes(r);
          });

          if (ownerEntry && Number(ownerEntry.userId) === currentUserId) {
            teacherName = session?.user?.name || "Me";
          } else if (ownerEntry && ownerEntry.user) {
            const u = ownerEntry.user;
            teacherName =
              u.name ||
              (u.fname ? `${u.fname} ${u.lname || ""}`.trim() : null) ||
              u.username ||
              u.email;
          } else {
            teacherName = "Unknown Teacher";
          }

          const createdDate = c.createAt
            ? new Date(c.createAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "";

          const myRole = myUserClassEntry.role?.roleName?.toLowerCase();
          const isOwner = myRole === "owner";

          const classObj: ClassItem = {
            id: c.classId ?? c.id,
            code: c.classname ?? "Unnamed",
            teacher: teacherName,
            due: `Created ${createdDate}`,
            problem: c.classname ?? "",
            isOwner,
          };

          if (["owner", "teacher", "creator"].includes(myRole)) {
            ownedList.push(classObj);
          } else {
            joinedList.push(classObj);
          }
        });

        setMyClasses(ownedList);
        setJoinedClasses(joinedList);
      }
    } catch (err) {
      console.error("Failed to fetch classes:", err);
    }
  };

  useEffect(() => {
    if (status === "loading" || !currentUserId) return;
    loadClasses();
  }, [currentUserId, status]);

  // ================= Delete Class =================
  const handleDeleteClass = async (classId: string | number) => {
    if (!currentUserId) return;

    const confirmed = confirm(
      "คุณต้องการลบ Class นี้ถาวรใช่หรือไม่?\nการกระทำนี้ไม่สามารถย้อนกลับได้"
    );
    if (!confirmed) return;

    try {
      await apiDeleteClass(classId, currentUserId);
      setMyClasses((prev) =>
        prev.filter((c) => String(c.id) !== String(classId))
      );
    } catch {
      alert("ลบ Class ไม่สำเร็จ");
    }
  };

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ className: "", section: "", room: "" });
  };

  const handleCreateClass = async () => {
    const { className, section, room } = formData;
    if (!className || !section || !room) return;

    const payload = {
      classname: `${className} ${section}`,
      testcases: [],
      currentUserId,
      meta: { room },
    };

    setIsCreating(true);
    try {
      const result = await apiCreateClass(payload);
      if (result?.ok) {
        setMyClasses((prev) => [
          {
            id: result.class?.classId ?? result.class?.id,
            code: payload.classname,
            teacher: session?.user?.name || "You",
            due: "Just now",
            problem: payload.classname,
            isOwner: true,
          },
          ...prev,
        ]);
        closeModal();
      }
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
    <div className="pt-20 min-h-screen">
      <div className="pl-60">
        <Navbar />
        <div className="flex">
          <Sidebar />
          <div className="flex-1 flex flex-col p-20">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-300 pb-4 mb-6">
              <h2 className="text-4xl font-semibold">My Class</h2>

              {/* แสดงปุ่ม Create เฉพาะตอนมี Class */}
              {myClasses.length > 0 && (
                <button
                  onClick={openModal}
                  className="bg-[#0D3ACE] text-white px-4 py-2 rounded-lg hover:bg-[#0B2EA6]"
                >
                  + Create Class
                </button>
              )}
            </div>

            {/* My Class Content */}
            {myClasses.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-gray-500 mt-20">
                <div className="bg-blue-100 text-blue-600 p-6 rounded-full mb-6">
                  <BookOpen size={48} />
                </div>

                <p className="text-xl font-medium mb-2">
                  ยังไม่มี Class สำหรับบัญชีนี้
                </p>
                <p className="text-sm mb-6 text-center">
                  เริ่มต้นสร้าง Class เพื่อจัดการนักเรียนและ Lab ของคุณ
                </p>

                <button
                  onClick={openModal}
                  className="bg-[#0D3ACE] text-white px-6 py-3 rounded-lg hover:bg-[#0B2EA6]"
                >
                  + Create Class
                </button>
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myClasses.map((c, index) => (
                  <Link
                    href={`/classes/${encodeURIComponent(String(c.id))}`}
                    key={`my-${index}`}
                  >
                    <ClassCard
                      {...c}
                      // ✅ ส่ง URL รูปภาพที่สุ่มได้เข้าไป
                      profileImage={getAvatarUrl(c.teacher)}
                      onDeleteClick={
                        c.isOwner ? () => handleDeleteClass(c.id) : undefined
                      }
                    />
                  </Link>
                ))}
              </div>
            )}

            {/* Joined Class */}
            <h2 className="text-4xl font-semibold border-b border-gray-300 pb-1 mt-12 pb-4 mb-6">
              Joined Class
            </h2>

            {joinedClasses.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-gray-500 py-20">
                <div className="bg-gray-100 text-gray-500 p-6 rounded-full mb-6">
                  <BookOpen size={48} />
                </div>

                <p className="text-xl font-medium mb-2">
                  ยังไม่มี Class ที่เข้าร่วมสำหรับบัญชีนี้
                </p>
                <p className="text-sm text-center">
                 ลองเข้าร่วมเพื่อเริ่มทำแบบฝึกหัดและเรียนรู้ไปพร้อมกัน
                </p>
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {joinedClasses.map((c, index) => (
                  <Link
                    href={`/classes/${encodeURIComponent(String(c.id))}`}
                    key={`joined-${index}`}
                  >
                    <ClassCard_Other 
                        {...c} 
                        // ✅ ส่ง URL รูปภาพที่สุ่มได้เข้าไป
                        profileImage={getAvatarUrl(c.teacher)}
                    />
                  </Link>
                ))}
              </div>
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