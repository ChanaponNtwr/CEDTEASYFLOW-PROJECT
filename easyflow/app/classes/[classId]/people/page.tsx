"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Tabs from "../../../Addpeople/_components/Tabs";
import AddPersonModal from "../../../Addpeople/_components/AddPersonModal";
import PeopleList from "../../../Addpeople/_components/PeopleList";
import { useSearchParams, usePathname } from "next/navigation";
import { apiGetClassUsers } from "@/app/service/FlowchartService";

// --- ปรับ Interface ให้ตรงกับ JSON ที่ได้จาก Backend ---
interface ApiUserDetail {
  id: number;
  fname: string;
  lname: string;
  name: string;
  email: string;
  image?: string;
}

interface ApiRole {
  roleId: number;
  roleName: string;
}

interface ApiUserClassItem {
  userId: number;
  classId: number;
  roleId: number;
  user: ApiUserDetail; // ข้อมูลคนอยู่ที่นี่
  role: ApiRole;       // ข้อมูลบทบาทอยู่ที่นี่
}

interface UIUser {
  name: string;
  email: string;
  position?: string;
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

  useEffect(() => {
    if (!classId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiGetClassUsers(classId);

        // response.users คือ Array ของ ApiUserClassItem
        if (response && Array.isArray(response.users)) {
          const allData: ApiUserClassItem[] = response.users;

          const newTeachers: UIUser[] = [];
          const newTAs: UIUser[] = [];
          const newStudents: UIUser[] = [];

          allData.forEach((item) => {
            // 1. ดึงข้อมูล User จาก item.user
            const uData = item.user; 
            // 2. ดึงข้อมูล Role Name จาก item.role.roleName
            const rData = item.role;

            const userForUI: UIUser = {
              name: uData.name || `${uData.fname} ${uData.lname}` || "Unknown",
              email: uData.email || "-",
              position: rData?.roleName || "",
            };

            // 3. แปลง Role Name เป็นตัวพิมพ์เล็กเพื่อเช็คเงื่อนไข
            // ใช้ Optional Chaining (?.) และ String() เพื่อความปลอดภัย
            const roleName = rData?.roleName ? String(rData.roleName).toLowerCase() : "";

            if (roleName === "owner" || roleName === "teacher") {
              newTeachers.push(userForUI);
            } else if (roleName === "ta") {
              newTAs.push(userForUI);
            } else if (roleName === "student") {
              newStudents.push(userForUI);
            } else {
                // กรณีไม่เข้าเงื่อนไข (อาจจะใส่เป็น Student ไปก่อน หรือ log ดู)
                // newStudents.push(userForUI);
                console.warn("Unknown role:", roleName);
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
    };

    fetchData();
  }, [classId]);

  // ... (ส่วน Modal และ Render เหมือนเดิม) ...

  const openModal = (role: "Teacher" | "TA" | "Students") => {
    setModalRole(role);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);
  const getPeople = (role: "Teacher" | "TA" | "Students") =>
    role === "Teacher" ? teachers : role === "TA" ? tas : students;
  const getSetter = (role: "Teacher" | "TA" | "Students") =>
    role === "Teacher" ? setTeachers : role === "TA" ? setTAs : setStudents;

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

            <AddPersonModal
              visible={modalOpen}
              onClose={closeModal}
              role={modalRole}
              addedPeople={getPeople(modalRole)}
              setAddedPeople={getSetter(modalRole) as any}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Addpeople;