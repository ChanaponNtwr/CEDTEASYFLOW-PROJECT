"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Tabs from "../../../Addpeople/_components/Tabs";
import AddPersonModal from "../../../Addpeople/_components/AddPersonModal";
import PeopleList from "../../../Addpeople/_components/PeopleList";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { 
  apiGetClassUsers, 
  apiUpdateUserRole, 
  apiRemoveUserFromClass, 
  apiLeaveClass 
} from "@/app/service/FlowchartService"; 
import { useSession } from "next-auth/react";

interface UIUser {
  name: string;
  email: string;
  position?: string;
  id: number; 
}

function Addpeople() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter(); // ✅ Import router
  const { data: session, status } = useSession();

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
  
  const [canManage, setCanManage] = useState<boolean>(false);
  const [amIOwner, setAmIOwner] = useState<boolean>(false); // ✅ เพิ่ม state เพื่อเช็คว่าเป็น Owner ไหม

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
        
        const currentUid = session?.user ? ((session.user as any).id || (session.user as any).userId) : null;
        let myRole = "";

        allData.forEach((item) => {
          const uData = item.user;
          const rData = item.role;

          if (currentUid && String(uData.id) === String(currentUid)) {
             myRole = rData?.roleName?.toLowerCase() || "";
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

        const isOwner = myRole === "owner";
        const isTeacher = myRole === "teacher";
        
        setAmIOwner(isOwner);
        setCanManage(isOwner || isTeacher);
      }
    } catch (err: any) {
      console.error("Error fetching class users:", err);
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [classId, session]);

  useEffect(() => {
    if (status === "loading") return;
    fetchData();
  }, [fetchData, status]);

  const openModal = (role: "Teacher" | "TA" | "Students") => {
    setModalRole(role);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  const handleRoleChange = async (targetUserId: number, newRoleStr: "Teacher" | "TA" | "Students") => {
    if(!classId || !currentUserId) return;
    
    let roleId = 2; // Default Student
    if (newRoleStr === "Teacher") roleId = 1;
    else if (newRoleStr === "TA") roleId = 3;
    else if (newRoleStr === "Students") roleId = 2;

    const confirmMsg = `Are you sure you want to change this user's role to ${newRoleStr}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
        setLoading(true);
        await apiUpdateUserRole(classId, targetUserId, roleId, currentUserId);
        alert(`User role updated to ${newRoleStr}`);
        fetchData(); 
    } catch (error) {
        console.error("Change role failed", error);
        alert("Failed to update role.");
        setLoading(false);
    }
  };

  // ✅ ฟังก์ชันจัดการการลบ User หรือ การออกจาก Class
  const handleRemoveUser = async (targetUserId: number) => {
    if (!classId || !currentUserId) return;

    // กรณีที่ 1: ลบตัวเอง (Leave Class)
    if (targetUserId === currentUserId) {
        if (amIOwner) {
            alert("Owner cannot leave the class. You must delete the class or transfer ownership.");
            return;
        }

        if (!confirm("Are you sure you want to LEAVE this class?")) return;

        try {
            setLoading(true);
            await apiLeaveClass(classId, currentUserId);
            alert("You have left the class.");
            router.push("/myclass"); // กลับไปหน้า Dashboard หรือหน้าอื่น
        } catch (error) {
            console.error("Leave class failed:", error);
            alert("Failed to leave class.");
            setLoading(false);
        }
    } 
    // กรณีที่ 2: ลบคนอื่น (Kick User) - ต้องมีสิทธิ์ canManage
    else {
        if (!canManage) return; 

        if (!confirm("Are you sure you want to remove this user from the class?")) return;

        try {
            setLoading(true);
            await apiRemoveUserFromClass(classId, targetUserId, currentUserId);
            // alert("User removed successfully.");
            fetchData(); // โหลดข้อมูลใหม่
        } catch (error) {
            console.error("Remove user failed:", error);
            alert("Failed to remove user.");
            setLoading(false);
        }
    }
  };

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
                {/* ✅ ส่ง Props เพิ่ม: onRemove, canManage, currentUserId */}
                <PeopleList 
                    title="Teacher" 
                    people={teachers} 
                    onAdd={canManage ? () => openModal("Teacher") : undefined} 
                    onRoleChange={canManage ? handleRoleChange : undefined}
                    onRemove={handleRemoveUser} 
                    canManage={canManage}
                    currentUserId={currentUserId}
                />
                <PeopleList 
                    title="TA" 
                    people={tas} 
                    onAdd={canManage ? () => openModal("TA") : undefined} 
                    onRoleChange={canManage ? handleRoleChange : undefined}
                    onRemove={handleRemoveUser}
                    canManage={canManage}
                    currentUserId={currentUserId}
                />
                <PeopleList 
                    title="Students" 
                    people={students} 
                    onAdd={canManage ? () => openModal("Students") : undefined} 
                    onRoleChange={canManage ? handleRoleChange : undefined}
                    onRemove={handleRemoveUser}
                    canManage={canManage}
                    currentUserId={currentUserId}
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