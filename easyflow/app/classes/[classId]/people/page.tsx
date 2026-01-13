"use client";

import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Tabs from "../../../Addpeople/_components/Tabs";
import AddPersonModal from "../../../Addpeople/_components/AddPersonModal";
import PeopleList from "../../../Addpeople/_components/PeopleList";
import { useSearchParams, usePathname } from "next/navigation";
import { apiGetClassUsers } from "@/app/service/FlowchartService";

interface UIUser {
  name: string;
  email: string;
  position?: string;
  id?: number;
}

function Addpeople() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Resolve Class ID logic
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

  const [modalOpen, setModalOpen] = useState(false);
  const [modalRole, setModalRole] = useState<"Teacher" | "TA" | "Students">("Teacher");

  // แยก fetchData ออกมาเป็น useCallback เพื่อให้เรียกซ้ำได้เมื่อเพิ่มคนเสร็จ
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

        allData.forEach((item) => {
          const uData = item.user;
          const rData = item.role;

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
      }
    } catch (err: any) {
      console.error("Error fetching class users:", err);
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  // เรียก fetchData เมื่อ classId เปลี่ยน
  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
                <PeopleList title="Teacher" people={teachers} onAdd={() => openModal("Teacher")} />
                <PeopleList title="TA" people={tas} onAdd={() => openModal("TA")} />
                <PeopleList title="Students" people={students} onAdd={() => openModal("Students")} />
              </>
            )}

            {/* Modal */}
            <AddPersonModal
              visible={modalOpen}
              onClose={closeModal}
              role={modalRole}
              classId={classId}     // ✅ ส่ง classId
              onUserAdded={fetchData} // ✅ ส่งฟังก์ชัน refresh เมื่อเพิ่มสำเร็จ
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Addpeople;