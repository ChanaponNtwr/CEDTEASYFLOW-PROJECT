"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { FaExclamationTriangle, FaTimes, FaCheck } from "react-icons/fa";

function Navbar() {
  const { data: session, status } = useSession();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isLoading = status === "loading";
  const user = session?.user ?? null;

  // แสดงเฉพาะชื่อ (ไม่เอานามสกุล)
  const firstName = user?.name?.split(" ")[0] ?? "User";

  // --- Modal state for logout confirmation ---
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const openLogoutModal = () => {
    setLogoutModalOpen(true);
    setIsDropdownOpen(false); // close dropdown when opening modal (preserve UI)
  };
  const closeLogoutModal = () => {
    setLogoutModalOpen(false);
  };

  const confirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut({ callbackUrl: "/login" });
      // signOut will redirect; this line may never run depending on next-auth flow
    } finally {
      setIsSigningOut(false);
      setLogoutModalOpen(false);
    }
  };
  // --- end modal ---

  return (
    <>
      <div className="fixed top-0 left-0 w-full bg-blue-600 text-white p-4 flex justify-between items-center z-[1100]">
        <div className="flex items-center">
          <Link href="/">
            <motion.img
              src="https://img5.pic.in.th/file/secure-sv1/Esay-Flow.png"
              alt="EasyFlow Logo"
              className="h-14 mr-6 cursor-pointer"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
            />
          </Link>
        </div>

        <div className="flex items-center space-x-10">
          <Link href="/" className="hover:underline hover:scale-105 transition-all cursor-pointer">
            Home
          </Link>

          {!isLoading && user && (
            <>
              <Link href="/mylab" className="hover:underline hover:scale-105 transition-all cursor-pointer">
                My Labs
              </Link>
              <Link href="/myclass" className="hover:underline hover:scale-105 transition-all cursor-pointer">
                Study
              </Link>
            </>
          )}

          <div className="relative">
            {!isLoading && user ? (
              <>
                <div
                  className="flex items-center space-x-3 cursor-pointer"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <Image
                    src={user.image ?? "/default-avatar.png"}
                    alt="profile"
                    width={35}
                    height={35}
                    className="rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/default-avatar.png";
                    }}
                  />
                  <span>{firstName}</span>
                  <svg
                    className={`w-4 h-4 ml-1 transition-transform duration-300 ease-in-out ${
                      isDropdownOpen ? "rotate-180" : "rotate-0"
                    }`}
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
                    <Link href="/profile" className="block px-4 py-2 hover:bg-gray-100 rounded-md">
                      Profile
                    </Link>
                    {/* ------------- Modified: open modal instead of direct signOut ------------- */}
                    <button
                      onClick={openLogoutModal}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded-md"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </>
            ) : (
              !isLoading && (
                <Link
                  href="/login"
                  className="px-4 py-2 bg-white text-blue-600 rounded-md font-medium hover:opacity-90"
                >
                  Login
                </Link>
              )
            )}
          </div>
        </div>
      </div>

      {/* ---------- AnimatePresence Modal for Logout Confirmation ---------- */}
      <AnimatePresence>
        {logoutModalOpen && (
          <motion.div
            className="fixed inset-0 z-[1200] flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLogoutModal}
            aria-modal="true"
            role="dialog"
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeLogoutModal}
              aria-hidden
            />

            {/* Modal Panel */}
            <motion.div
              className="relative z-50 w-full max-w-md mx-auto"
              initial={{ opacity: 0, scale: 0.98, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 12 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
                <div className="px-6 pt-8 pb-6 flex flex-col items-center bg-red-50">
                  <div className="flex items-center justify-center w-20 h-20 rounded-xl bg-red-600 shadow-md">
                    <FaExclamationTriangle size={36} className="text-white" />
                  </div>

                  <h3 className="mt-4 text-2xl font-extrabold text-red-700">
                    ออกจากระบบ
                  </h3>
                </div>

                <div className="px-6 pb-6 pt-4">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap text-center">
                    คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ? คุณจะถูกนำไปยังหน้าลงชื่อเข้าใช้อีกครั้ง
                  </p>

                  <div className="w-full border-t border-gray-200 my-4" />

                  <div className="mt-6 flex items-center justify-center gap-4">
                    <button
                      onClick={closeLogoutModal}
                      className="inline-flex items-center justify-center px-6 py-2 rounded-full border border-slate-300 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 text-sm font-medium shadow-sm"
                      aria-label="ยกเลิก"
                    >
                      <FaTimes className="mr-2" /> ยกเลิก
                    </button>

                    <button
                      onClick={confirmSignOut}
                      className="inline-flex items-center justify-center px-6 py-2 rounded-full bg-red-600 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 text-sm font-medium shadow-sm hover:bg-red-700"
                      aria-label="ยืนยันออกจากระบบ"
                      disabled={isSigningOut}
                    >
                      {isSigningOut ? (
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                        </svg>
                      ) : (
                        <FaCheck className="mr-2" />
                      )}
                      {isSigningOut ? "Signing out..." : "ออกจากระบบ"}
                    </button>
                  </div>
                </div>

                <button
                  onClick={closeLogoutModal}
                  aria-label="close"
                  className="absolute top-4 right-4 bg-white border border-gray-200 rounded-full w-9 h-9 flex items-center justify-center shadow"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M6 6L18 18M6 18L18 6" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default Navbar;