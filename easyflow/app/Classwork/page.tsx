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

  // fallback UI (กรณี class ยังไม่โหลด)
  const fallbackAssignments = [
    {
      title: "Lab 2: ปัญหา: การออกแบบซอฟต์แวร์ขั้นสูง",
      due: "Due Mar 1, 11:59 PM",
    },
    {
      title: "Lab 1: ปัญหา: การออกแบบซอฟต์แวร์",
      due: "Due Today",
    },
  ];

  const handleCreateClick = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);
  const handleAddClick = () => console.log("Add button clicked");

  // ===============================
  // Fetch class detail
  // ===============================
  useEffect(() => {
    const classId = propClassId ?? routeClassId;

    console.debug("Classwork: resolved classId =", classId);

    if (!classId) {
      console.warn("Classwork: no classId found — skipping apiGetClass");
      return;
    }

    let mounted = true;

    const fetchClass = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await apiGetClass(classId);
        if (!mounted) return;

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
      } catch (err: any) {
        if (!mounted) return;
        console.error("apiGetClass failed:", err);
        setError(err?.message || "Failed to load class detail");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchClass();

    return () => {
      mounted = false;
    };
  }, [propClassId, routeClassId]);

  // ===============================
  // Prepare assignments list
  // ===============================
  const assignments = React.useMemo(() => {
    if (classDetail && Array.isArray(classDetail.classLabs)) {
      return classDetail.classLabs.map((lab: any) => ({
        title: lab.title ?? lab.name ?? `Lab ${lab.labId ?? lab.id}`,
        due:
          lab.dueDisplay ??
          (lab.dueDate ? `Due ${lab.dueDate}` : "No due date"),
        labId: lab.labId ?? lab.id,
      }));
    }
    return fallbackAssignments;
  }, [classDetail]);

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

            {loading && <div className="py-4">Loading class details...</div>}
            {error && (
              <div className="py-4 text-red-600">Error: {error}</div>
            )}

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
          </div>
        </div>

        <ImportLabModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onAddClick={handleAddClick}
          formData={formData}
          setFormData={setFormData}
        />
      </div>
    </div>
  );
}

export default Classwork;
