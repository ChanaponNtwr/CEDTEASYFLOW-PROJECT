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
  const router = useRouter(); 
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

  const [activeTab, setActiveTab] = useState<string>("People"); 
  const [teachers, setTeachers] = useState<UIUser[]>([]);
  const [tas, setTAs] = useState<UIUser[]>([]);
  const [students, setStudents] = useState<UIUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [canManage, setCanManage] = useState<boolean>(false);
  const [amIOwner, setAmIOwner] = useState<boolean>(false);

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

  const handleRemoveUser = async (targetUserId: number) => {
    if (!classId || !currentUserId) return;

    if (targetUserId === currentUserId) {
       const confirmLeave = window.confirm("Are you sure you want to leave this class?");
       if (!confirmLeave) return;
       try {
         setLoading(true);
         await apiLeaveClass(classId, currentUserId);
         alert("You have left the class.");
         router.push("/myclass"); 
       } catch (error) {
         console.error("Leave class error:", error);
         alert("Failed to leave class.");
       } finally {
         setLoading(false);
       }
       return;
    }

    const confirmRemove = window.confirm("Are you sure you want to remove this user?");
    if (!confirmRemove) return;

    try {
      setLoading(true);
      await apiRemoveUserFromClass(classId, targetUserId, currentUserId);
      alert("User removed from class.");
      fetchData();
    } catch (error) {
      console.error("Remove user error:", error);
      alert("Failed to remove user.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="flex pt-16">
        {/* Sidebar Fixed */}
        <div className="hidden lg:block w-64 fixed h-[calc(100vh-4rem)] top-16 left-0 overflow-y-auto bg-white border-r border-gray-200 z-10">
          <Sidebar />
        </div>

        {/* Main Content */}
        <main className="flex-1 lg:pl-64 w-full">
          {/* ✅ Container: Full width with max constraint for ultra-wide screens */}
          <div className="max-w-[1920px] mx-auto w-full p-4 sm:p-20 space-y-8">
            
            {/* Tabs Section */}
            <Tabs 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
            />

            {/* Content Area */}
            {loading && teachers.length === 0 ? (
               <div className="flex justify-center items-center py-20 text-gray-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2 mr-3"></div>
                  Loading people...
               </div>
            ) : error ? (
              <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-center">
                {error}
              </div>
            ) : (
              <div className="space-y-10 max-w-6xl mx-auto">
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
              </div>
            )}
            
            {/* Modal */}
            {canManage && classId && (
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
        </main>
      </div>
    </div>
  );
}

export default Addpeople;