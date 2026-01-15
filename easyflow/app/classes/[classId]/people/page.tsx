"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Tabs from "../../../Addpeople/_components/Tabs";
import AddPersonModal from "../../../Addpeople/_components/AddPersonModal";
import PeopleList from "../../../Addpeople/_components/PeopleList";
import { useSearchParams, usePathname } from "next/navigation";
import { apiGetClassUsers } from "@/app/service/FlowchartService";

// ✅ 1. Import NextAuth Hook
import { useSession } from "next-auth/react";

interface UIUser {
  name: string;
  email: string;
  position?: string;
  id?: number;
}

function Addpeople() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const { data: session, status } = useSession();

  // ✅ 1. ดึง User ID ออกมาจาก Session เตรียมไว้ที่ component level
  const currentUserId = session?.user 
    ? Number((session.user as any).id || (session.user as any).userId) 
    : 0;

  const resolveClassId = (): string | null => {
    const qCandidates = ["classId", "id", "class"];
    for (const k of qCandidates) {
      const v = searchParams?.get(k);
      if (v) return v;
    }
    try {
      const parts = pathname?.split("/").filter(Boolean) ?? [];
      const numeric = parts.find((seg) => /^\d+$/.test(seg));
      if (numeric) return numeric;
    } catch {}
    return null;
  };

  const classId = resolveClassId();

  const [activeTab, setActiveTab] = useState<string>("Classwork");
  const [teachers, setTeachers] = useState<UIUser[]>([]);
  const [tas, setTAs] = useState<UIUser[]>([]);
  const [students, setStudents] = useState<UIUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // State เก็บ Role
  const [canManage, setCanManage] = useState<boolean>(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalRole, setModalRole] = useState<"Teacher" | "TA" | "Students">("Teacher");

  const fetchData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiGetClassUsers(classId);

      if (response && Array.isArray(response.users)) {
        const allData: any[] = response.users;
        const newTeachers: UIUser[] = [];
        const newTAs: UIUser[] = [];
        const newStudents: UIUser[] = [];
        
        // ✅ 3. ดึง Current User ID จาก Session
        const currentUid = session?.user ? ((session.user as any).id || (session.user as any).userId) : null;
        let myRole = "";

        console.log("📍 [AddPeople] Current User ID from Session:", currentUid);

        allData.forEach((item) => {
          const uData = item.user;
          const rData = item.role;

          // เช็คว่าคนนี้คือเราไหม? (แปลงเป็น String ทั้งคู่เพื่อความชัวร์)
          if (currentUid && String(uData.id) === String(currentUid)) {
             myRole = rData?.roleName?.toLowerCase() || "";
             console.log("📍 [AddPeople] Found Me! Role is:", myRole);
          }

          const userForUI: UIUser = {
            id: uData.id,
            name: uData.name || `${uData.fname} ${uData.lname}` || "Unknown",
            email: uData.email || "-",
            position: rData?.roleName || "",
          };

          const roleName = rData?.roleName ? String(rData.roleName).toLowerCase() : "";

          if (roleName === "owner" || roleName === "teacher") {
            newTeachers.push(userForUI);
          } else if (roleName === "ta") {
            newTAs.push(userForUI);
          } else if (roleName === "student") {
            newStudents.push(userForUI);
          }
        });

        setTeachers(newTeachers);
        setTAs(newTAs);
        setStudents(newStudents);

        // กำหนดสิทธิ์: Owner หรือ Teacher
        const hasPermission = myRole === "owner" || myRole === "teacher";
        console.log("📍 [AddPeople] Can Manage?:", hasPermission);
        setCanManage(hasPermission);
      }
    } catch (err: any) {
      console.error("Error fetching class users:", err);
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [classId, session]); // ✅ ใส่ session ลงใน dependency เพื่อให้โหลดใหม่เมื่อ Login เสร็จ

  useEffect(() => {
    // ถ้า session ยังโหลดไม่เสร็จ ให้รอก่อนได้ (หรือจะโหลดเลยก็ได้ แต่ currentUid จะเป็น null ชั่วคราว)
    if (status === "loading") return;
    fetchData();
  }, [fetchData, status]);

  const openModal = (role: "Teacher" | "TA" | "Students") => {
    setModalRole(role);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  if (!classId) return <div className="pt-20 text-center">Missing Class ID</div>;

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <div className="pl-36">
        <Navbar />
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col px-10 py-10 h-screen w-screen overflow-hidden ">
            <div className="ml-34 mt-10">
              <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            {loading && <div className="text-gray-500 mt-4">Loading users...</div>}
            {error && <div className="text-red-500 mt-4">{error}</div>}

            {!loading && !error && (
              <>
                <PeopleList 
                    title="Teacher" 
                    people={teachers} 
                    onAdd={canManage ? () => openModal("Teacher") : undefined} 
                />
                <PeopleList 
                    title="TA" 
                    people={tas} 
                    onAdd={canManage ? () => openModal("TA") : undefined} 
                />
                <PeopleList 
                    title="Students" 
                    people={students} 
                    onAdd={canManage ? () => openModal("Students") : undefined} 
                />
              </>
            )}

            {/* Modal */}
            {canManage && (
                <AddPersonModal
                visible={modalOpen}
                onClose={closeModal}
                role={modalRole}
                classId={classId}     
                onUserAdded={fetchData}
                currentUserId={currentUserId}
                />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Addpeople;