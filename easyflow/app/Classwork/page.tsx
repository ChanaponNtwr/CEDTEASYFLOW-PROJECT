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

  const [formData, setFormData] = useState<{
    labId: string;
    dueDate: string;
    dueTime: string;
  }>({
    labId: "",
    dueDate: "",
    dueTime: "",
  });

  const [classDetail, setClassDetail] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // userId for sending as x-user-id (dev/testing). In prod use real auth flow.
  const [userId, setUserId] = useState<string | null>(null);

  const handleCreateClick = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // ===============================
  // fetchClass: reusable, used on mount & after import
  // ===============================
  const fetchClass = async (classId: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiGetClass(classId);
      setClassDetail(data);

      // auto select first lab (ถ้ายังไม่ได้เลือก)
      const firstLabId =
        data?.classLabs?.length > 0
          ? data.classLabs[0].labId ?? data.classLabs[0].id
          : "";

      setFormData((prev) => ({
        ...prev,
        labId: prev.labId || firstLabId,
      }));

      // — set userId from sessionStorage if present, otherwise fallback to owner or teacher for dev testing
      try {
        const sessionUid =
          sessionStorage.getItem("userId") || sessionStorage.getItem("x-user-id");
        if (sessionUid) {
          setUserId(sessionUid);
        } else {
          const ownerId = data?.userClasses?.find((u: any) => u.role?.roleName === "owner")
            ?.user?.id;
          const teacherId = data?.userClasses?.find((u: any) => u.role?.roleName === "teacher")
            ?.user?.id;
          const fallback = ownerId ?? teacherId ?? null;
          if (fallback) setUserId(String(fallback));
        }
      } catch {
        // ignore sessionStorage errors
      }
    } catch (err: any) {
      console.error("apiGetClass failed:", err);
      setError(err?.message || "Failed to load class detail");
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // Fetch class detail on mount / classId change
  // ===============================
  useEffect(() => {
    const classId = propClassId ?? routeClassId;

    console.debug("Classwork: resolved classId =", classId);

    if (!classId) {
      console.warn("Classwork: no classId found — skipping apiGetClass");
      return;
    }

    let mounted = true;

    (async () => {
      if (!mounted) return;
      await fetchClass(classId);
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propClassId, routeClassId]);

  // ===============================
  // handleAddClick: called by modal after successful import to refresh class
  // ===============================
  const handleAddClick = async () => {
    const classId = propClassId ?? routeClassId;
    if (!classId) return;
    await fetchClass(classId);
  };

  // ===============================
  // Prepare assignments list
  // ===============================
  const assignments = React.useMemo(() => {
    if (classDetail && Array.isArray(classDetail.classLabs) && classDetail.classLabs.length > 0) {
      return classDetail.classLabs.map((lab: any) => ({
        title: lab.title ?? lab.name ?? `Lab ${lab.labId ?? lab.id}`,
        due: lab.dueDisplay ?? (lab.dueDate ? `Due ${lab.dueDate}` : "No due date"),
        labId: lab.labId ?? lab.id,
      }));
    }
    return [];
  }, [classDetail]);

  const hasClassLoaded = classDetail !== null;

  // ===============================
  // Render
  // ===============================
  return (
    <div className="pt-20 min-h-screen bg-gray-100">
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
                  ? `Created ${new Date(classDetail.createAt).toLocaleString()}`
                  : "—"
              }
              backgroundImage="/images/classwork.png"
            />

            <FilterActions onCreateClick={handleCreateClick} />

            {/* Loading / Error / Empty-message / List */}
            {loading ? (
              <div className="py-4">Loading class details...</div>
            ) : error ? (
              <div className="py-4 text-red-600">Error: {error}</div>
            ) : assignments.length === 0 && hasClassLoaded ? (
              // ไม่มี lab ให้ขึ้นข้อความสวย ๆ ตรงกลาง (ไม่มีปุ่มเพิ่ม)
              <div className="flex items-center justify-center py-12 ">
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="mx-auto mb-4 w-20 h-20 flex items-center justify-center rounded-full bg-gradient-to-br from-gray-50 to-gray-100">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 0 1 2-2h3.5a1.5 1.5 0 0 1 1.06.44l1.5 1.5A1.5 1.5 0 0 0 12.94 7H19a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 11h8" />
                      </svg>
                    </div>

                    <h2 className="text-lg font-semibold text-gray-800 mb-2">ยังไม่มี Lab ในคลาสนี้</h2>
                    <p className="text-sm text-gray-500">
                      ไม่พบงานหรือ Lab ใด ๆ สำหรับคลาสนี้ในขณะนี้ — เมื่อมีการเพิ่ม Lab รายการจะแสดงที่นี่
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col space-y-4">
                {assignments.map((assignment: any, index: number) => (
                  <Link
                    key={index}
                    href={
                      assignment.labId
                        ? `/labviewscore/${assignment.labId}`
                        : "/labviewscore"
                    }
                  >
                    <AssignmentItem
                      title={assignment.title}
                      due={assignment.due}
                      onEditClick={() =>
                        console.log(`Edit assignment: ${assignment.title}`)
                      }
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
