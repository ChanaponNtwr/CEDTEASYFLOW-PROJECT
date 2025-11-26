"use client";

import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import { useState } from "react";

export default function Profile() {
  const { data: session, status } = useSession();

  const [flowcharts] = useState([
    { id: 1, title: "Lab 3 in Project Flowchart 2", image: "https://img2.pic.in.th/pic/image-113.png" },
    { id: 2, title: "Lab 4 in Project Flowchart 2", image: "https://img2.pic.in.th/pic/image-113.png" },
    { id: 3, title: "Lab 5 in Project Flowchart 2", image: "https://img2.pic.in.th/pic/image-113.png" },
  ]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-700 text-xl">You are not logged in.</p>
      </div>
    );
  }

  const user = session.user;
  const defaultImage = "https://img5.pic.in.th/file/secure-sv1/Ellipse-270.png";
  const userImage = user?.image ?? defaultImage;

  return (
    <div style={{ backgroundColor: "#F5F2F0" }} className="min-h-screen w-full">
      <Navbar />

      {/* Wrapper ใหม่: ใช้ transform scale เพื่อลดขนาดทั้งหมดภายใน */}
      <div className="flex justify-center mt-8">
        <div style={{ transform: 'scale(0.9)', transformOrigin: 'top center', display: 'inline-block' }}>
          {/* Container โปรไฟล์ (โค้ดเดิม) */}
          <div className="relative w-[1920px] mx-auto bg-[#F5F2F0] overflow-hidden">
            <div className="absolute top-[118px] left-[15px] w-[1880px] h-[274px] bg-[rgba(13,58,206,0.45)] rounded-t-[40px]" />
            <div className="absolute top-[392px] left-[15px] w-[1880px] h-[388px] bg-[#FBFBFB] rounded-b-[40px]" />

            <img
              src={userImage}
              alt="user"
              className="absolute top-[269px] left-[84px] w-[246px] h-[246px] rounded-full border-[9px] border-white bg-[#E3B8FF] object-cover"
            />
            <div className="absolute top-[550px] left-[84px] text-[42px] font-bold text-black">
              {user.name}
            </div>
            <div className="absolute top-[610px] left-[84px] text-[30px] font-normal text-black">
              Email: {user.email}
            </div>

            <div className="absolute top-[682px] left-[84px] flex items-center gap-4">
              <button className="bg-[#EE7A2E] text-white text-[25px] font-medium rounded-full px-10 py-3 shadow-md hover:brightness-110 transition">
                Upgrade
              </button>
              <p className="w-[260px] text-black text-[20px] font-semibold leading-6">
                Upgrade your package to add more students
              </p>
            </div>

            {/* 🧾 Flowchart Section */}
            <div className="relative w-[1880px] bg-[#FBFBFB] rounded-[40px] p-10 mt-[800px] mx-auto min-h-[400px]">
              <h2 className="text-[40px] font-semibold text-black mb-6">My Flowchart</h2>

              <div className="flex flex-wrap gap-10">
                {flowcharts.map((flowchart) => (
                  <div key={flowchart.id} className="flex flex-col items-center w-[238px]">
                    <img
                      src={flowchart.image}
                      alt={flowchart.title}
                      className="w-full h-[268px] rounded-lg border border-[#989898] object-cover"
                    />
                    <p className="mt-3 text-[20px] text-black text-center">{flowchart.title}</p>
                  </div>
                ))}
              </div>

              <div className="absolute top-10 right-10 w-[150px] h-[65px] bg-[#B92627] rounded-full flex items-center justify-center text-white text-[25px] font-medium shadow-md">
                All
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
