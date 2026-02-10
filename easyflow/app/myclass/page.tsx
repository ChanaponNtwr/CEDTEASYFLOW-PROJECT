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
import { FaPlus, FaChalkboardTeacher, FaBookReader, FaInbox } from "react-icons/fa";

export type ClassItem = {
  id: number | string;
  code: string;
  title: string;
  teacher: string;
  due: string;
  problem: string;
  isOwner: boolean;
};

const getAvatarUrl = (name: string) => {
  return `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(
    name
  )}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;
};

function Myclass() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // ✅ เพิ่ม State Error

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

  // ================= Load Classes =================
  const loadClasses = async () => {
    if (!currentUserId) return;
    setLoading(true);
    setError(null); // ✅ Reset Error ก่อนโหลด

    try {
      const res: any = await apiGetClasses();

      if (res.ok && Array.isArray(res.classes)) {
        // เรียงลำดับจากวันที่ล่าสุดไปเก่าสุด
        const sortedClasses = res.classes.sort((a: any, b: any) => {
          return new Date(b.createAt).getTime() - new Date(a.createAt).getTime();
        });

        const ownedList: ClassItem[] = [];
        const joinedList: ClassItem[] = [];

        sortedClasses.forEach((c: any) => {
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
            teacherName = ownerEntry.user.name || ownerEntry.user.username || "Unknown";
          } else {
            teacherName = "Unknown Teacher";
          }

          const createdDate = c.createAt
            ? new Date(c.createAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "";

          const myRole = myUserClassEntry.role?.roleName?.toLowerCase();
          const isOwner = ["owner", "teacher", "creator"].includes(myRole);

          const classObj: ClassItem = {
            id: c.classId ?? c.id,
            code: String(c.classId ?? c.id),
            title: c.classname ?? "Untitled Class",
            teacher: teacherName,
            due: createdDate,
            problem: c.meta?.room ? `Room ${c.meta.room}` : "No Room",
            isOwner,
          };

          if (isOwner) {
            ownedList.push(classObj);
          } else {
            joinedList.push(classObj);
          }
        });

        setMyClasses(ownedList);
        setJoinedClasses(joinedList);
      } else {
        // กรณี API ตอบกลับมาแต่ไม่ ok หรือไม่มี classes
        // อาจจะไม่ได้ถือเป็น Error ร้ายแรง แต่ถ้าต้องการ Handle ก็ใส่ setError ได้
      }
    } catch (err: any) {
      console.error("Failed to fetch classes:", err);
      setError(err?.message || "Failed to load classes."); // ✅ Set Error message
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading" || !currentUserId) return;
    loadClasses();
  }, [currentUserId, status]);

  // ================= Actions =================
  const handleDeleteClass = async (classId: string | number) => {
    if (!currentUserId) return;
    const confirmed = confirm("Are you sure you want to delete this class?");
    if (!confirmed) return;

    try {
      await apiDeleteClass(classId, currentUserId);
      setMyClasses((prev) =>
        prev.filter((c) => String(c.id) !== String(classId))
      );
    } catch {
      alert("Failed to delete class.");
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
      classname: `${className} (${section})`,
      testcases: [],
      currentUserId,
      meta: { room },
    };
    try {
      const result = await apiCreateClass(payload);
      if (result?.ok) {
        loadClasses();
        closeModal();
      }
    } catch (err) {
      alert("Failed to create class");
    }
  };

  // Loading Session (Full Screen)
  if (status === "loading") {
    return (
      <div className="min-h-screen w-full bg-[#F9FAFB] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading session...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F9FAFB]">
      <div className="pt-20 pl-0 md:pl-64 transition-all duration-300">
        <Navbar />
        <Sidebar />

        <div className="p-8 max-w-7xl mx-auto min-h-screen flex flex-col space-y-12">
          
          {/* ================= My Courses Section ================= */}
          <div>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                  <FaChalkboardTeacher className="text-blue-600" />
                  My Courses
                </h2>
                <p className="text-gray-500 mt-1 text-sm ml-1">
                  Manage your active courses and student lists
                </p>
              </div>

              <button
                onClick={openModal}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 font-medium"
              >
                <FaPlus size={14} /> Create New Class
              </button>
            </div>

            {/* ✅ ใช้ Logic Loading ที่คุณต้องการ */}
            <div className="min-h-[300px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                  Loading class details...
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-center">
                  Error: {error}
                </div>
              ) : (
                <>
                  {myClasses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 ">
                      <FaInbox className="w-16 h-16 mb-4 text-gray-200" />
                      <p className="text-sm text-gray-400">
                        No courses have been created
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {myClasses.map((c) => (
                        <Link
                          key={`my-${c.id}`}
                          href={`/classes/${c.id}`}
                          className="block h-full"
                        >
                          <ClassCard
                            code={c.code}
                            title={c.title}
                            teacher={c.teacher}
                            due={c.due}
                            problem={c.problem}
                            profileImage={getAvatarUrl(c.teacher)}
                            onDeleteClick={() => handleDeleteClass(c.id)}
                          />
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ================= Enrolled Courses Section ================= */}
          <div className="pt-8 border-t border-gray-200">
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <FaBookReader className="text-emerald-600" />
                Enrolled Courses
              </h2>
              <p className="text-gray-500 mt-1 text-sm ml-1">
                Access the courses you are currently attending
              </p>
            </div>

            {/* ✅ ใช้ Logic Loading แบบเดียวกัน หรือแยกตามต้องการ (ที่นี่ใช้ตัวแปร loading ตัวเดียวกัน) */}
            <div className="min-h-[300px]">
              {loading ? (
                 <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                   Loading enrolled courses...
                 </div>
              ) : error ? (
                 <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-lg text-center">
                   Error: {error}
                 </div>
              ) : (
                <>
                  {joinedClasses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 ">
                      <FaInbox className="w-16 h-16 mb-4 text-gray-200" />
                      <p className="text-sm text-gray-400">
                        You are not currently enrolled in any courses
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {joinedClasses.map((c) => (
                        <Link
                          key={`join-${c.id}`}
                          href={`/classes/${c.id}`}
                          className="block h-full"
                        >
                          <ClassCard_Other
                            code={c.code}
                            title={c.title}
                            teacher={c.teacher}
                            due={c.due}
                            problem={c.problem}
                            profileImage={getAvatarUrl(c.teacher)}
                          />
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
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