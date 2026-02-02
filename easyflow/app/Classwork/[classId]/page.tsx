"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation"; // ✅ เพิ่ม useSearchParams, useRouter
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Tabs from "./_components/Tabs";
import ClassHeader from "./_components/ClassHeader";
import FilterActions from "./_components/FilterActions";
import AssignmentItem from "./_components/AssignmentItem";
import ImportLabModal from "./_components/ImportLabModal";
import { apiGetClass, apiRemoveLabFromClass } from "@/app/service/FlowchartService";
import { useSession } from "next-auth/react";

type FilterType = "all" | "oldest" | "newest" | "todo";

function Classwork({ classId: propClassId }: { classId?: string }) {
  const params = useParams();
  const searchParams = useSearchParams(); // ✅ Hook สำหรับอ่าน Query Params
  const router = useRouter(); // ✅ Hook สำหรับจัดการ URL
  
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

  const [filter, setFilter] = useState<FilterType>("newest");

  // ✅ EFFECT: เช็คว่ากลับมาจากหน้า Select Lab หรือไม่
  useEffect(() => {
    const shouldOpen = searchParams?.get("openImport");
    if (shouldOpen === "true") {
      setIsModalOpen(true);
      
      // ลบ query param ออกจาก URL เพื่อไม่ให้ refresh แล้วเด้งอีก (Optional แต่แนะนำเพื่อ UX ที่ดี)
      // ใช้ window.history.replaceState เพื่อไม่ให้เกิด reload
      const newUrl = window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    }
  }, [searchParams]);

  const handleCreateClick = () => {
    setEditingLab(null);
    setFormData({ labId: "", dueDate: "", dueTime: "" });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLab(null);
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

  const handleAddClick = async () => {
    if (!finalClassId) return;
    await fetchClass(finalClassId);
  };

  const handleEditLab = (labId: string, rawDueDate: string, title: string) => {
    setEditingLab({
      labId,
      dueDate: rawDueDate,
      labName: title,
    });
    setIsModalOpen(true);
  };

  const handleDeleteLab = async (labId: string) => {
    if (!finalClassId) return;
    if (!currentUserId) {
      alert("Cannot determine current user. Please login.");
      return;
    }

    const confirmed = confirm("ลบ Lab นี้จาก Class ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้");
    if (!confirmed) return;

    try {
      setLoading(true);
      setError(null);
      await apiRemoveLabFromClass(finalClassId, labId, currentUserId);
      await fetchClass(finalClassId);
    } catch (err: any) {
      console.error("Failed to remove lab from class:", err);
      alert(err?.message || "ลบ Lab ไม่สำเร็จ");
      setError(err?.message || "Failed to remove lab");
    } finally {
      setLoading(false);
    }
  };

  const assignments = useMemo(() => {
    if (!classDetail?.classLabs?.length) return [];

    let list = classDetail.classLabs.map((cl: any) => {
      const lab = cl.lab || {};
      const actualDueDate = cl.dueDate || lab.dueDate;

      return {
        labId: lab.labId,
        title: lab.labname || "Untitled Lab",
        problemSolving: lab.problemSolving || "",
        rawDueDate: actualDueDate || "",
        dueDate: actualDueDate
          ? new Date(actualDueDate).toLocaleDateString("th-TH", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "No due date",
      };
    });

    if (filter === "newest") {
      list.sort(
        (a: any, b: any) =>
          new Date(b.rawDueDate || 0).getTime() -
          new Date(a.rawDueDate || 0).getTime()
      );
    }

    if (filter === "oldest") {
      list.sort(
        (a: any, b: any) =>
          new Date(a.rawDueDate || 0).getTime() -
          new Date(b.rawDueDate || 0).getTime()
      );
    }

    if (filter === "todo") {
      const now = new Date().getTime();
      list = list.filter((a: any) => {
        if (!a.rawDueDate) return true;
        return new Date(a.rawDueDate).getTime() >= now;
      });
    }

    return list;
  }, [classDetail, filter]);

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
              onFilterChange={setFilter}
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
                        onEditClick={
                          canEdit
                            ? () => handleEditLab(a.labId, a.rawDueDate, a.title)
                            : undefined
                        }
                        onDeleteClick={
                          canEdit
                            ? () => handleDeleteLab(a.labId)
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

        {canEdit && (
          <ImportLabModal
            isOpen={isModalOpen}
            onClose={closeModal}
            onAddClick={handleAddClick}
            formData={formData}
            setFormData={setFormData}
            classId={finalClassId}
            userId={currentUserId}
            isEditMode={!!editingLab}
            editData={editingLab || undefined}
          />
        )}
      </div>
    </div>
  );
}

export default Classwork;