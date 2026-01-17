"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Tabs from "./_components/Tabs";
import ClassHeader from "./_components/ClassHeader";
import FilterActions from "./_components/FilterActions";
import AssignmentItem from "./_components/AssignmentItem";
import ImportLabModal from "./_components/ImportLabModal";
import { apiGetClass } from "@/app/service/FlowchartService";

// Import NextAuth Hook
import { useSession } from "next-auth/react";

function Classwork({ classId: propClassId }: { classId?: string }) {
  const params = useParams();
  const routeClassId = (params as any)?.classId;
  const finalClassId = propClassId ?? routeClassId; // รวม ClassId ให้เป็นตัวแปรเดียวใช้ง่ายๆ

  // เรียกใช้ Session Hook
  const { data: session, status } = useSession();

  // ✅ 1. สร้างตัวแปรกลางสำหรับดึง User ID ให้ชัวร์ที่สุด
  // รองรับทั้ง Google Provider, Credentials หรือ Custom Adapter
  const currentUserId = useMemo(() => {
    if (!session?.user) return undefined;
    const user = session.user as any;
    // ลองหา id จากหลายๆ key ที่เป็นไปได้
    return user.id || user.userId || user.sub;
  }, [session]);

  const [activeTab, setActiveTab] = useState<string>("Classwork");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    labId: "",
    dueDate: "",
    dueTime: "",
  });

  const [classDetail, setClassDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State เก็บ Role ของ User ปัจจุบัน
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  const handleCreateClick = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const fetchClass = async (cid: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiGetClass(cid);
      setClassDetail(data);

      console.log("📍 [Classwork] Current User ID:", currentUserId);

      // ✅ 2. ใช้ currentUserId ที่เตรียมไว้ เช็ค Role
      if (currentUserId && data.userClasses) {
        // ค้นหา User ใน Class (เทียบทั้ง userId และ user.id)
        const myEntry = data.userClasses.find((uc: any) => {
          const idInRelation = uc.userId ? String(uc.userId) : null;
          const idInUserObj = uc.user?.id ? String(uc.user.id) : null;
          const currentStr = String(currentUserId);

          return idInRelation === currentStr || idInUserObj === currentStr;
        });

        console.log("📍 [Classwork] Found My Entry:", myEntry);

        if (myEntry?.role?.roleName) {
          const role = myEntry.role.roleName.toLowerCase();
          console.log("📍 [Classwork] My Role Found:", role);
          setCurrentUserRole(role);
        } else {
          console.warn("⚠️ [Classwork] User found but Role is missing OR User not found in this class");
        }
      }
    } catch (err: any) {
      console.error("apiGetClass failed:", err);
      setError(err?.message || "Failed to load class");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading") return;
    if (finalClassId) {
      fetchClass(finalClassId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalClassId, status, session]); // เพิ่ม session ใน dependency เผื่อโหลดเสร็จทีหลัง

  const handleAddClick = async () => {
    if (!finalClassId) return;
    await fetchClass(finalClassId);
  };

  const assignments = useMemo(() => {
    if (!classDetail?.classLabs?.length) return [];
    return classDetail.classLabs.map((cl: any) => {
      const lab = cl.lab;
      return {
        labId: lab.labId,
        title: lab.labname,
        problemSolving: lab.problemSolving,
        dueDate: lab.dueDate
          ? new Date(lab.dueDate).toLocaleDateString("th-TH", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "No due date",
      };
    });
  }, [classDetail]);

  const hasClassLoaded = classDetail !== null;

  // *** เช็คสิทธิ์: เป็น owner หรือ teacher หรือไม่ ***
  const canEdit = ["owner", "teacher"].includes(currentUserRole);
  
  return (
    <div className="pt-20 min-h-screen bg-white">
      <div className="pl-60">
        <Navbar />
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col p-20">
            <Tabs
              classId={finalClassId}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            <ClassHeader
              code={classDetail?.classname ?? "—"}
              teacher={
                classDetail?.userClasses?.find(
                  (u: any) => u.role?.roleName === "owner"
                )?.user?.name ?? "—"
              }
              schedule={
                classDetail?.createAt
                  ? `Created ${new Date(classDetail.createAt).toLocaleString()}`
                  : "—"
              }
              backgroundImage="/images/classwork.png"
            />

            <FilterActions
              onCreateClick={canEdit ? handleCreateClick : undefined}
            />

            {/* Content */}
            {loading ? (
              <div className="py-4">Loading class details...</div>
            ) : error ? (
              <div className="py-4 text-red-600">Error: {error}</div>
            ) : assignments.length === 0 && hasClassLoaded ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-gray-800 mb-2">
                    ยังไม่มี Lab ในคลาสนี้
                  </h2>
                  <p className="text-sm text-gray-500">
                    เมื่อมีการเพิ่ม Lab รายการจะแสดงที่นี่
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col space-y-4 pb-16">
                {assignments.map((a: any, idx: number) => (
                  <Link key={idx} href={`/labviewscore/${a.labId}`}>
                    <AssignmentItem
                      title={a.title}
                      due={`Due ${a.dueDate}`}
                      onEditClick={
                        canEdit
                          ? () => console.log("Edit lab:", a.labId)
                          : undefined
                      }
                    />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ✅ 3. ส่ง currentUserId ไปให้ Modal */}
        {canEdit && (
          <ImportLabModal
            isOpen={isModalOpen}
            onClose={closeModal}
            onAddClick={handleAddClick}
            formData={formData}
            setFormData={setFormData}
            classId={finalClassId}
            userId={currentUserId} // <--- ส่งค่าที่ผ่าน useMemo แล้วไป
          />
        )}
      </div>
    </div>
  );
}

export default Classwork;