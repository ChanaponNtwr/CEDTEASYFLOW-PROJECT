"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";

function Navbar() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <div className="fixed top-0 left-0 w-full bg-blue-600 text-white p-4 flex justify-between items-center z-[1100]">
      <div className="flex items-center">
        <img
          src="https://img5.pic.in.th/file/secure-sv1/Esay-Flow.png"
          alt="EasyFlow Logo"
          className="h-14 mr-6"
        />
      </div>
      <div className="flex items-center space-x-14">
        <Link href="/homepage" className="hover:underline hover:scale-105 transition-all cursor-pointer">
          Home
        </Link>
        <Link href="/mylab" className="hover:underline hover:scale-105 transition-all cursor-pointer">
          My Labs
        </Link>
        <Link href="/myclass" className="hover:underline hover:scale-105 transition-all cursor-pointer">
          Study
        </Link>
        <div className="relative">
          <div
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <img
              src="https://img2.pic.in.th/pic/9440461.jpg"
              alt="Profile"
              className="h-8 w-8 rounded-full mr-2"
            />
            <span>Chanapon</span>
            <svg
              className="w-4 h-4 ml-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </div>
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white text-black rounded-md shadow-lg">
              <Link href="/profile" className="block px-4 py-2 hover:bg-gray-100">Profile</Link>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Navbar;
