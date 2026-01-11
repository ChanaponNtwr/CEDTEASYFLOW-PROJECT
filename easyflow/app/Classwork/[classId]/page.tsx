"use client";

import React, { useEffect, useState } from "react";
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

function Classwork({ classId: propClassId }: { classId?: string }) {
  const params = useParams();
  const routeClassId = (params as any)?.classId;

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

  // ใช้สำหรับส่ง x-user-id (dev only)
  const [userId, setUserId] = useState<string | null>(null);

  const handleCreateClick = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // ===============================
  // Fetch class detail (reuse)
  // ===============================
  const fetchClass = async (classId: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiGetClass(classId);
      setClassDetail(data);

      // set userId จาก session หรือ fallback เป็น owner / teacher (dev)
      try {
        const sessionUid =
          sessionStorage.getItem("userId") ||
          sessionStorage.getItem("x-user-id");

        if (sessionUid) {
          setUserId(sessionUid);
        } else {
          const ownerId = data?.userClasses?.find(
            (u: any) => u.role?.roleName === "owner"
          )?.user?.id;

          const teacherId = data?.userClasses?.find(
            (u: any) => u.role?.roleName === "teacher"
          )?.user?.id;

          const fallback = ownerId ?? teacherId ?? null;
          if (fallback) setUserId(String(fallback));
        }
      } catch {
        // ignore
      }
    } catch (err: any) {
      console.error("apiGetClass failed:", err);
      setError(err?.message || "Failed to load class");
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // Initial load
  // ===============================
  useEffect(() => {
    const classId = propClassId ?? routeClassId;
    if (!classId) return;

    fetchClass(classId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propClassId, routeClassId]);

  // ===============================
  // After import refresh
  // ===============================
  const handleAddClick = async () => {
    const classId = propClassId ?? routeClassId;
    if (!classId) return;
    await fetchClass(classId);
  };

  // ===============================
  // Prepare assignments (🔥 FIXED)
  // ===============================
  const assignments = React.useMemo(() => {
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

  // ===============================
  // Render
  // ===============================
  return (
    <div className="pt-20 min-h-screen bg-white">
      <div className="pl-60">
        <Navbar />

        <div className="flex h-screen">
          <Sidebar />

          <div className="flex-1 flex flex-col p-20">
            <Tabs
              classId={propClassId ?? routeClassId}
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
                  ? `Created ${new Date(
                      classDetail.createAt
                    ).toLocaleString()}`
                  : "—"
              }
              backgroundImage="/images/classwork.png"
            />

            <FilterActions onCreateClick={handleCreateClick} />

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
                        onEditClick={() => {
                          console.log("Edit lab:", a.labId);
                          // TODO: เปิด modal / ไปหน้าแก้ไข lab
                        }}
                      />

                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <ImportLabModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onAddClick={handleAddClick}
          formData={formData}
          setFormData={setFormData}
          classId={propClassId ?? routeClassId}
          userId={userId ?? undefined}
        />
      </div>
    </div>
  );
}

export default Classwork;
