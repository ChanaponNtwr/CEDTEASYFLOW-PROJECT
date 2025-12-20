// app/profile/page.tsx (หรือไฟล์ Profile ของคุณ)
"use client";

import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import FilterActions from "./_components/FilterActions";
import { useState, useMemo } from "react";
import { signIn } from "next-auth/react";

export default function Profile() {
  const { data: session, status } = useSession();

  // ตัวอย่างข้อมูล: เพิ่ม status เพื่อใช้กรอง "To Do"
  const [flowcharts] = useState([
    { id: 1, title: "Lab 3 in Project Flowchart 2", image: "https://img2.pic.in.th/pic/image-113.png", tag: "Lab 3", status: "done" },
    { id: 2, title: "Lab 4 in Project Flowchart 2", image: "https://img2.pic.in.th/pic/image-113.png", tag: "Lab 4", status: "todo" },
    { id: 3, title: "Lab 5 in Project Flowchart 2", image: "https://img2.pic.in.th/pic/image-113.png", tag: "Lab 5", status: "done" },
  ]);

  const [filter, setFilter] = useState<"all" | "oldest" | "newest" | "todo">("all");

  const handleFilterChange = (f: "all" | "oldest" | "newest" | "todo") => {
    setFilter(f);
  };

  const filteredFlowcharts = useMemo(() => {
    if (filter === "all") return flowcharts.slice();
    if (filter === "newest") {
      if (flowcharts.length === 0) return [];
      const latest = flowcharts.reduce((a, b) => (a.id > b.id ? a : b));
      return [latest];
    }
    if (filter === "oldest") {
      return flowcharts.slice().sort((a, b) => a.id - b.id);
    }
    if (filter === "todo") {
      return flowcharts.filter((f) => f.status === "todo");
    }
    return flowcharts;
  }, [flowcharts, filter]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p>Loading...</p>
      </div>
    );
  }

  // if (!session) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-gray-100">
  //       <p className="text-gray-700 text-xl">You are not logged in.</p>
  //     </div>
  //   );
  // }

  if (!session) {
  signIn(); // redirect ไป login
  return null;
  }

  const user = session.user;
  const defaultImage = "https://img5.pic.in.th/file/secure-sv1/Ellipse-270.png";
  const userImage = user?.image ?? defaultImage;

  return (
    <div style={{ backgroundColor: "#F5F2F0" }} className="min-h-screen w-full">
      <Navbar />

      <div className="flex justify-center mt-8">
        <div style={{ transform: "scale(0.9)", transformOrigin: "top center", display: "inline-block" }}>
          <div className="relative w-[1920px] mx-auto bg-[#F5F2F0] overflow-hidden">
            <div className="absolute top-[118px] left-[15px] w-[1880px] h-[274px] bg-[rgba(13,58,206,0.45)] rounded-t-[40px]" />
            <div className="absolute top-[392px] left-[15px] w-[1880px] h-[388px] bg-[#FBFBFB] rounded-b-[40px]" />

            <img
              src={userImage}
              alt="user"
              className="absolute top-[269px] left-[84px] w-[246px] h-[246px] rounded-full border-[9px] border-white bg-[#E3B8FF] object-cover"
            />
            <div className="absolute top-[550px] left-[84px] text-[42px] font-bold text-black">{user.name}</div>
            <div className="absolute top-[610px] left-[84px] text-[30px] font-normal text-black">Email: {user.email}</div>

            <div className="absolute top-[682px] left-[84px] flex items-center gap-4">
              <button className="bg-[#EE7A2E] text-white text-[25px] font-medium rounded-full px-10 py-3 shadow-md hover:brightness-110 transition cursor-pointer">
                Upgrade
              </button>
              <p className="w-[260px] text-black text-[20px] font-semibold leading-6">Upgrade your package to add more students</p>
            </div>

            {/* Flowchart Section */}
            <div className="relative w-[1880px] bg-[#FBFBFB] rounded-[40px] p-10 mt-[800px] mx-auto min-h-[400px]">
              <h2 className="text-[40px] font-semibold text-black mb-6">My Flowchart</h2>

              {/* ใช้ FilterActions component ที่คุณให้มา */}
              <div className="absolute top-10 right-10">
                <FilterActions
                  onFilterChange={handleFilterChange}
                  onCreateClick={() => {
                    // ตัวอย่าง handler เมื่อกด Create — แก้ตามต้องการ
                    console.log("Create clicked");
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-10 mt-6">
                {filteredFlowcharts.map((flowchart) => (
                  <div
                    key={flowchart.id}
                    className="flex flex-col items-center w-[238px] hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <img
                      src={flowchart.image}
                      alt={flowchart.title}
                      className="w-full h-[268px] rounded-lg border border-[#989898] object-cover"
                    />
                    <p className="mt-3 text-[20px] text-black text-center">{flowchart.title}</p>
                    {/* <span className="mt-1 text-[14px] text-gray-600">{flowchart.tag}</span> */}
                    {/* <span className="text-[12px] text-gray-500 mt-1">Status: {flowchart.status}</span> */}
                  </div>
                ))}

                {filteredFlowcharts.length === 0 && (
                  <div className="w-full text-center text-gray-500 text-[20px] py-10">
                    No flowcharts found for "{filter}"
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
