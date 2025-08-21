"use client";

import { useSession } from "next-auth/react";
import Navbar from '@/components/Navbar';
import { useState } from "react";

export default function Profile() {
  const { data: session, status } = useSession();

  const [flowcharts] = useState([
    { id: 1, title: "Lab 3 in Project Flowchart 2", image: "https://img2.pic.in.th/pic/image-113.png" },
    { id: 2, title: "Lab 4 in Project Flowchart 2", image: "https://img2.pic.in.th/pic/image-113.png" },
    { id: 3, title: "Lab 5 in Project Flowchart 2", image: "https://img2.pic.in.th/pic/image-113.png" },
    { id: 4, title: "Lab 5 in Project Flowchart 2", image: "https://img2.pic.in.th/pic/image-113.png" }
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

  // ดึงข้อมูล user จาก session และปรับขนาดรูปให้ชัด
  console.log("Session:", session, "Status:", status);
  const user = session.user;
  const defaultImage = "https://img5.pic.in.th/file/secure-sv1/Ellipse-270.png";
  const userImage =
  user?.image
    ? user.image.includes("googleusercontent.com") && user.image.includes("=s")
      ? user.image.replace(/=s\d+-c/, "=s400-c")
      : user.image
    : defaultImage;

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 pt-10">
          <div className="flex flex-col lg:flex-row gap-8 min-h-screen w-full">
            {/* Profile Section */}
            <div className="w-full lg:w-1/3 bg-white p-6 rounded-xl shadow-lg min-h-screen">
              <div className="flex flex-col items-center h-full">
                <img
                  src={userImage}
                  alt={user?.name ?? "Profile"}
                  className="w-52 h-52 rounded-full border-4 border-orange-500 object-cover shadow-md"
                />
                <h2 className="mt-4 text-3xl font-semibold text-gray-900">{user?.name ?? "No Name"}</h2>
                <div className="mt-2 w-64 h-px bg-gray-300" />
                <p className="text-gray-600 text-lg">Email: {session?.user?.email}</p>
                <p className="mt-4 text-2xl text-gray-800">รายละเอียด แพ็คเก็ต</p>
              </div>
            </div>

            {/* Flowchart Section */}
            <div className="w-full lg:w-2/3 bg-white p-6 rounded-xl shadow-lg min-h-screen">
              <h1 className="text-4xl font-medium text-gray-900 mb-6">My Flowchart</h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {flowcharts.map((flowchart) => (
                  <div
                    key={flowchart.id}
                    className="bg-gray-50 p-4 rounded-lg shadow-md hover:scale-105 transition-all cursor-pointer"
                  >
                    <img
                      src={flowchart.image || `https://placehold.co/238x268`}
                      alt={flowchart.title}
                      className="w-full h-96 object-cover rounded-lg border border-gray-300"
                    />
                    <p className="mt-2 text-lg text-gray-700 text-center">{flowchart.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
