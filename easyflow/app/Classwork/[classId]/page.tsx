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
  // Safe access to params
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

  const [formData, setFormData] = useState({
    labId: "",
    dueDate: "",
    dueTime: "",
  });

  const [classDetail, setClassDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>("");

  const handleCreateClick = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

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

  const assignments = useMemo(() => {
    if (!classDetail?.classLabs?.length) return [];
    return classDetail.classLabs.map((cl: any) => {
      const lab = cl.lab || {};
      return {
        labId: lab.labId,
        title: lab.labname || "Untitled Lab",
        problemSolving: lab.problemSolving || "",
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
                        onEditClick={
                          canEdit
                            ? () => console.log("Edit lab:", a.labId)
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
          />
        )}
      </div>
    </div>
  );
}

export default Classwork;