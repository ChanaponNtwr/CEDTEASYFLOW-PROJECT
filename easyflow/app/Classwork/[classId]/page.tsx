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
import { useSession } from "next-auth/react";

function Classwork({ classId: propClassId }: { classId?: string }) {
  const params = useParams();
  const routeClassId = params ? (params.classId as string) : undefined;
  const finalClassId = propClassId ?? routeClassId;

  const { data: session, status } = useSession();

  const currentUserId = useMemo(() => {
    if (!session?.user) return undefined;
    const user = session.user as any;
    return user.id || user.userId || user.sub;
  }, [session]);

  const [activeTab, setActiveTab] = useState<string>("Classwork");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // ✅ เพิ่ม State สำหรับเก็บข้อมูล Lab ที่กำลังแก้ไข
  const [editingLab, setEditingLab] = useState<{
    labId: string;
    dueDate: string;
    labName: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    labId: "",
    dueDate: "",
    dueTime: "",
  });

  const [classDetail, setClassDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  // ✅ ปรับปรุง: เมื่อกดปุ่ม Import (Create) ให้เคลียร์ค่า edit และเปิด Modal
  const handleCreateClick = () => {
    setEditingLab(null); // เคลียร์โหมดแก้ไข
    setFormData({ labId: "", dueDate: "", dueTime: "" }); // เคลียร์ฟอร์ม
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLab(null); // รีเซ็ตเมื่อปิด
  };

  const fetchClass = async (cid: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiGetClass(cid);
      setClassDetail(data);

      if (currentUserId && data.userClasses) {
        const myEntry = data.userClasses.find((uc: any) => {
          const idInRelation = uc.userId ? String(uc.userId) : null;
          const idInUserObj = uc.user?.id ? String(uc.user.id) : null;
          const currentStr = String(currentUserId);
          return idInRelation === currentStr || idInUserObj === currentStr;
        });

        if (myEntry?.role?.roleName) {
          const role = myEntry.role.roleName.toLowerCase();
          setCurrentUserRole(role);
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
  }, [finalClassId, status, session]);

  // เมื่อบันทึกเสร็จ ให้รีเฟรชข้อมูล
  const handleAddClick = async () => {
    if (!finalClassId) return;
    await fetchClass(finalClassId);
  };

  // ✅ ฟังก์ชันเมื่อกดปุ่ม Edit ที่ AssignmentItem
  const handleEditLab = (labId: string, rawDueDate: string, title: string) => {
    setEditingLab({
      labId,
      dueDate: rawDueDate, // ส่งค่าวันที่ดิบ (ISO String) ไปให้ Modal แปลง
      labName: title,
    });
    setIsModalOpen(true);
  };

const assignments = useMemo(() => {
    if (!classDetail?.classLabs?.length) return [];
    return classDetail.classLabs.map((cl: any) => {
      const lab = cl.lab || {};
      
      // ✅ แก้ไข: ให้ดึง dueDate จาก 'cl' (ตารางความสัมพันธ์) ก่อน
      // เพราะการสั่งงาน (Assignment) จะเก็บวันส่งไว้ที่นี่
      const actualDueDate = cl.dueDate || lab.dueDate; 

      return {
        labId: lab.labId,
        title: lab.labname || "Untitled Lab",
        problemSolving: lab.problemSolving || "",
        
        // ✅ ใช้ actualDueDate แทน lab.dueDate
        rawDueDate: actualDueDate || "", 
        
        dueDate: actualDueDate
          ? new Date(actualDueDate).toLocaleDateString("th-TH", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })
          : "No due date",
      };
    });
  }, [classDetail]);

  const hasClassLoaded = classDetail !== null;
  const canEdit = ["owner", "teacher"].includes(currentUserRole);

  return (
    <div className="pt-20 min-h-screen bg-white">
      <div className="pl-60">
        <Navbar />
        <div className="flex h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col p-20">
            <Tabs
              classId={finalClassId || ""}
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

            {loading ? (
              <div className="py-4">Loading class details...</div>
            ) : error ? (
              <div className="py-4 text-red-600">Error: {error}</div>
            ) : assignments.length === 0 && hasClassLoaded ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-gray-800 mb-2">
                    No Labs Yet
                  </h2>
                  <p className="text-sm text-gray-500">
                    Labs will appear here once added.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col space-y-4 pb-16">
                {assignments.map((a: any, idx: number) => {
                  const linkHref = canEdit
                    ? `/labviewscore/${a.labId}`
                    : `/Studentlab/${a.labId}`;

                  return (
                    <Link key={idx} href={linkHref}>
                      <AssignmentItem
                        title={a.title}
                        description={a.problemSolving}
                        due={`Due ${a.dueDate}`}
                        // ✅ เชื่อมต่อปุ่ม Edit ให้เรียก handleEditLab
                        onEditClick={
                          canEdit
                            ? () => handleEditLab(a.labId, a.rawDueDate, a.title)
                            : undefined
                        }
                      />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ✅ ส่ง Props isEditMode และ editData ไปให้ ImportLabModal */}
        {canEdit && (
          <ImportLabModal
            isOpen={isModalOpen}
            onClose={closeModal}
            onAddClick={handleAddClick}
            formData={formData}
            setFormData={setFormData}
            classId={finalClassId}
            userId={currentUserId}
            isEditMode={!!editingLab} // ถ้ามี editingLab แปลว่าเป็นโหมดแก้ไข
            editData={editingLab || undefined} // ส่งข้อมูลที่จะแก้เข้าไป
          />
        )}
      </div>
    </div>
  );
}

export default Classwork;