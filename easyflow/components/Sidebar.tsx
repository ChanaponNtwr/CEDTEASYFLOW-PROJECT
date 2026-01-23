"use client";
import React, { useEffect, useState } from "react";
import { FaUser, FaBook } from "react-icons/fa";
import { motion } from "framer-motion";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { apiGetClasses } from "@/app/service/FlowchartService"; 

// --- Animation Variants ---
const itemVariants = {
  hover: { 
    scale: 1.03,
    background: "linear-gradient(90deg, rgba(59,130,246,0.15), rgba(59,130,246,0.1))",
    boxShadow: "0px 2px 6px rgba(0,0,0,0.1)",
    x: 2,
    transition: { type: "spring", stiffness: 250 },
  },
};

const iconVariants = {
  hover: { rotate: 20, transition: { type: "spring", stiffness: 300 } },
};

const getInitials = (name: string) => {
  if (!name) return "??";
  return name.substring(0, 2).toUpperCase();
};

function Sidebar() {
  const { data: session } = useSession();
  const [teachingClasses, setTeachingClasses] = useState<any[]>([]);
  const [enrolledClasses, setEnrolledClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!session?.user) return;
      
      try {
        setLoading(true);
        const user = session.user as any;
        const currentUserId = user.id || user.userId || user.sub;

        const data = await apiGetClasses();
        console.log("Sidebar API Data:", data); // 🔍 ดู Log ตรงนี้ใน Console (F12)
        
        const teach: any[] = [];
        const enroll: any[] = [];

        if (data && Array.isArray(data.classes)) {
          data.classes.forEach((cls: any) => {
            // Check for valid ID immediately
            const validId = cls.id || cls._id || cls.classId;
            if (!validId) return; // ถ้าไม่มี ID ข้ามไปเลย

            const myRelation = cls.userClasses?.find(
              (uc: any) => 
                String(uc.userId) === String(currentUserId) || 
                String(uc.user?.id) === String(currentUserId)
            );

            if (!myRelation) return;

            const roleName = myRelation?.role?.roleName?.toLowerCase();

            if (roleName === "owner" || roleName === "teacher") {
              teach.push(cls);
            } else {
              enroll.push(cls);
            }
          });
        }

        setTeachingClasses(teach);
        setEnrolledClasses(enroll);
      } catch (error) {
        console.error("Failed to fetch classes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session]);

  // ฟังก์ชันช่วยดึง ID (กันเหนียว)
  const getClassId = (cls: any) => {
    return cls.id || cls._id || cls.classId;
  };

  return (
    <div className="w-64 h-screen bg-white shadow-md p-4 fixed left-0 top-20 overflow-y-auto pb-20 z-40">
      
      {/* ---------------- TEACHING Section ---------------- */}
      <div className="mb-6">
        <div className="flex items-center mb-2 bg-blue-600 px-2 py-3 rounded shadow-sm">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center mr-2">
            <FaUser className="text-blue-600 w-4 h-4" />
          </div>
          <h3 className="text-white font-semibold tracking-wide">TEACHING</h3>
        </div>
        
        <ul>
          {loading ? (
             <li className="text-gray-400 text-sm px-2 animate-pulse">Loading...</li>
          ) : teachingClasses.length === 0 ? (
             <li className="text-gray-400 text-sm px-2">No classes teaching</li>
          ) : (
            teachingClasses.map((cls, index) => {
              const cId = getClassId(cls);
              if (!cId) return null; // ถ้าไม่มี ID ไม่ต้องเรนเดอร์

              return (
                <Link 
                  key={cId}
                  href={`/classwork/${cId}`}
                  passHref 
                  legacyBehavior
                >
                  <motion.li
                    className="flex items-center mb-2 px-2 py-2 rounded cursor-pointer text-gray-700 font-medium transition-colors"
                    whileHover="hover"
                    variants={itemVariants}
                  >
                    <motion.span 
                      className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mr-3 text-white text-xs font-bold shrink-0 shadow-sm"
                      variants={iconVariants}
                    >
                      {getInitials(cls.classname)}
                    </motion.span>
                    <span className="truncate text-sm">{cls.classname}</span>
                  </motion.li>
                </Link>
              );
            })
          )}
        </ul>
      </div>

      {/* ---------------- ENROLLED Section ---------------- */}
      <div>
        <div className="flex items-center mb-2 bg-blue-600 px-2 py-3 rounded shadow-sm">
          <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center mr-2">
            <FaBook className="text-blue-600 w-4 h-4" />
          </div>
          <h3 className="text-white font-semibold tracking-wide">ENROLLED</h3>
        </div>

        <ul>
        {loading ? (
             <li className="text-gray-400 text-sm px-2 animate-pulse">Loading...</li>
          ) : enrolledClasses.length === 0 ? (
             <li className="text-gray-400 text-sm px-2">No classes enrolled</li>
          ) : (
            enrolledClasses.map((cls, index) => {
              const cId = getClassId(cls);
              if (!cId) return null; // ถ้าไม่มี ID ไม่ต้องเรนเดอร์

              return (
                <Link 
                  key={cId}
                  href={`/studentclass/${cId}`}
                  passHref 
                  legacyBehavior
                >
                  <motion.li
                    className="flex items-center mb-2 px-2 py-2 rounded cursor-pointer text-gray-700 font-medium transition-colors"
                    whileHover="hover"
                    variants={itemVariants}
                  >
                    <motion.span 
                      className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mr-3 text-white text-xs font-bold shrink-0 shadow-sm"
                      variants={iconVariants}
                    >
                      {getInitials(cls.classname)}
                    </motion.span>
                    <span className="truncate text-sm">{cls.classname}</span>
                  </motion.li>
                </Link>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

export default Sidebar;