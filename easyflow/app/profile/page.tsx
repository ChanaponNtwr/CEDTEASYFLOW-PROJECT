"use client";

import React from "react";
import { useSession, signIn } from "next-auth/react";
import Navbar from "@/components/Navbar";
import FilterActions from "./_components/FilterActions";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUserBannerColor } from "@/app/utils/userColor";
import Link from "next/link";
import { motion } from "framer-motion";

// API import
import { apiGetFlowchartsByUser } from "@/app/service/FlowchartService";

type UIFlowchart = {
  id: number | string;
  title: string;
  image: string;
  status: "done" | "todo";
};

export default function Profile() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [flowcharts, setFlowcharts] = useState<UIFlowchart[]>([]);
  const [loadingFlowcharts, setLoadingFlowcharts] = useState(false);

  const [filter, setFilter] = useState<"all" | "oldest" | "newest" | "todo">("all");

  const handleFilterChange = (f: "all" | "oldest" | "newest" | "todo") => {
    setFilter(f);
  };

  const resolveUserIdFromSession = (sess: any) => {
    if (!sess?.user) return null;
    const u = sess.user;
    return u.id ?? u.userId ?? u.sub ?? null;
  };

  useEffect(() => {
    if (!session?.user) return;

    const load = async () => {
      try {
        setLoadingFlowcharts(true);

        const userId = resolveUserIdFromSession(session);
        if (!userId) {
          console.warn("Profile: session.user ไม่พบ id");
          setFlowcharts([]);
          return;
        }

        const res = await apiGetFlowchartsByUser(userId);
        const items = Array.isArray(res)
          ? res
          : res?.flowcharts ?? res?.data ?? [];

        const mapped: UIFlowchart[] = (items || []).map((it: any) => ({
          id: it.flowchartId ?? it.id ?? `${it.labId ?? "?"}`,
          title: it.labName ?? `Flowchart #${it.flowchartId ?? it.id ?? "?"}`,
          image: "https://img2.pic.in.th/pic/image-113.png",
          status: it.submissionLocked ? "done" : "todo",
        }));

        setFlowcharts(mapped);
      } catch (err) {
        console.error("Load user flowcharts failed:", err);
        setFlowcharts([]);
      } finally {
        setLoadingFlowcharts(false);
      }
    };

    load();
  }, [session]);

  const filteredFlowcharts = useMemo(() => {
    if (filter === "all") return flowcharts.slice();
    if (filter === "newest") {
      if (flowcharts.length === 0) return [];
      const latest = flowcharts.reduce((a, b) =>
        Number(a.id) > Number(b.id) ? a : b
      );
      return [latest];
    }
    if (filter === "oldest") {
      return flowcharts.slice().sort((a, b) => Number(a.id) - Number(b.id));
    }
    if (filter === "todo") {
      return flowcharts.filter((f) => f.status === "todo");
    }
    return flowcharts;
  }, [flowcharts, filter]);

  // ---------------- AUTH STATE ----------------
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    signIn();
    return null;
  }

  // ---------------- USER DATA ----------------
  const user = session.user;

  const userSeed =
    (user as any)?.id ??
    (user as any)?.userId ??
    user?.email ??
    "default-user";

  const bannerColor = getUserBannerColor(userSeed);

  const defaultImage = "https://img5.pic.in.th/file/secure-sv1/Ellipse-270.png";
  const userImage = user?.image ?? defaultImage;

  // ---------------- UI ----------------
  return (
    <div style={{ backgroundColor: "#F5F2F0" }} className="min-h-screen w-full">
      <Navbar />

      <div className="flex justify-center mt-8">
        <div
          style={{ transform: "scale(0.9)", transformOrigin: "top center" }}
          className="inline-block"
        >
          <div className="relative w-[1920px] mx-auto bg-[#F5F2F0] overflow-hidden">
            {/* ✅ RANDOM COLOR BANNER */}
            <div
              className="absolute top-[118px] left-[15px] w-[1880px] h-[274px] rounded-t-[40px]"
              style={{ backgroundColor: bannerColor }}
            />

            <div className="absolute top-[392px] left-[15px] w-[1880px] h-[388px] bg-[#FBFBFB] rounded-b-[40px]" />

            <img
              src={userImage}
              alt="user"
              className="absolute top-[269px] left-[84px] w-[246px] h-[246px] rounded-full border-[9px] border-white bg-[#E3B8FF] object-cover"
            />

            <div className="absolute top-[550px] left-[84px] text-[42px] font-bold text-black">
              {user.name}
            </div>

            <div className="absolute top-[610px] left-[84px] text-[30px] text-black">
              Email: {user.email}
            </div>

            <div className="absolute top-[682px] left-[84px] flex items-center gap-4">
              <Link href="/upgrade">
                <motion.div
                  className="inline-block text-2xl px-6 py-3 bg-yellow-500 text-white font-bold rounded-full cursor-pointer shadow-lg"
                  whileHover={{
                    scale: 1.1,
                    boxShadow: "0px 0px 20px rgba(255,255,0,0.6)",
                    y: -3,
                    transition: { type: "spring", stiffness: 300 },
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  Upgrade
                </motion.div>
              </Link>
              <p className="w-[260px] text-black text-[20px] font-semibold">
                Upgrade your package to add more students
              </p>
            </div>

            {/* Flowchart Section */}
            <div className="relative w-[1880px] bg-[#FBFBFB] rounded-[40px] p-10 mt-[800px] mx-auto min-h-[400px]">
              <h2 className="text-[40px] font-semibold text-black mb-6">
                My Flowchart
              </h2>

              <div className="absolute top-10 right-10">
                <FilterActions
                  onFilterChange={handleFilterChange}
                  onCreateClick={() => console.log("Create clicked")}
                />
              </div>

              <div className="flex flex-wrap gap-10 mt-6">
                {filteredFlowcharts.map((flowchart) => (
                  <div
                    key={flowchart.id}
                    onClick={() =>
                      // <-- เปลี่ยนตรงนี้: ส่งพารามิเตอร์ disableSubmit=1
                      router.push(`/Dolab/${flowchart.id}?disableSubmit=1`)
                    }
                    className="flex flex-col items-center w-[238px] cursor-pointer hover:scale-[1.02] transition"
                  >
                    <img
                      src={flowchart.image}
                      alt={flowchart.title}
                      className="w-full h-[268px] rounded-lg border border-[#989898] object-cover"
                    />
                    <p className="mt-3 text-[20px] text-black text-center">
                      {flowchart.title}
                    </p>
                  </div>
                ))}

                {!loadingFlowcharts && filteredFlowcharts.length === 0 && (
                  <div className="w-full text-center text-gray-500 text-[20px] py-10">
                    No flowcharts found for "{filter}"
                  </div>
                )}

                {loadingFlowcharts && (
                  <div className="w-full text-center text-gray-500 text-[20px] py-10">
                    Loading flowcharts...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
