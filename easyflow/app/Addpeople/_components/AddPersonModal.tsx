"use client";

import React, { useState, useEffect } from "react";
import { X, Search, Plus, Check, Loader2 } from "lucide-react";
import { apiSearchUsers, apiAddUserToClass } from "@/app/service/FlowchartService";
import { motion, AnimatePresence } from "framer-motion"; // ✅ 1. Import Framer Motion

interface AddPersonModalProps {
  visible: boolean;
  onClose: () => void;
  role: "Teacher" | "TA" | "Students";
  classId: string;
  onUserAdded: () => void;
}

export default function AddPersonModal({
  visible,
  onClose,
  role,
  classId,
  onUserAdded,
}: AddPersonModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // --- Search Logic ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length > 1) {
        setIsSearching(true);
        try {
          const response = await apiSearchUsers(searchTerm);
          if (response && response.users) {
            setSearchResults(response.users);
          } else if (Array.isArray(response)) {
            setSearchResults(response);
          } else {
            setSearchResults([]);
          }
        } catch (error) {
          console.error("Search error:", error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // --- Reset Logic ---
  useEffect(() => {
    if (!visible) {
      setSearchTerm("");
      setSearchResults([]);
      setSelectedUser(null);
      setIsAdding(false);
    }
  }, [visible]);

  // --- Logic การ Add ---
  const handleAddUser = async () => {
    if (!selectedUser || !classId) return;

    // 1. ดึง ID ของคนกด (Actor) จาก LocalStorage
    let currentActorId = 3; // Default

    try {
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            const parsed = JSON.parse(storedUser);
            if (parsed.id) currentActorId = Number(parsed.id);
            else if (parsed.userId) currentActorId = Number(parsed.userId);
        }
    } catch (e) { 
        console.error("Error parsing user from localStorage", e);
    }

    // 2. Map Role Name -> Role ID
    let roleIdToSend = 2; // Default Student
    if (role === "Teacher") roleIdToSend = 1;
    else if (role === "TA") roleIdToSend = 3;
    else if (role === "Students") roleIdToSend = 2;

    console.log("Sending Payload:", {
        classId,
        targetUserId: selectedUser.id,
        roleId: roleIdToSend,
        actorId: currentActorId
    });

    setIsAdding(true);
    try {
      await apiAddUserToClass(
        classId, 
        selectedUser.id, 
        roleIdToSend, 
        currentActorId
      );
      
      if (onUserAdded) {
        onUserAdded(); 
      }
      onClose();
    } catch (err: any) {
      console.error("Failed to add user:", err);
      if (err.response?.status === 403) {
          alert(`Permission Denied: User ID ${currentActorId} is not the owner.`);
      } else {
          alert("Failed to add user. Please try again.");
      }
    } finally {
      setIsAdding(false);
    }
  };

  // ❌ ลบ if (!visible) return null; ออก เพราะเราจะใช้ AnimatePresence คุมแทน

  return (
    <AnimatePresence>
      {visible && (
        // ✅ 2. เปลี่ยน Outer Div เป็น motion.div สำหรับ Background Overlay
        <motion.div 
          className="fixed inset-0 bg-gray-900/20 backdrop-blur-md flex items-center justify-center z-[1000]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* ✅ 3. เปลี่ยน Inner Div เป็น motion.div สำหรับตัว Modal box */}
          <motion.div 
            className="bg-white rounded-xl shadow-2xl w-[500px] overflow-hidden flex flex-col max-h-[90vh]"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Add {role}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                <X size={24} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  className="w-full border border-gray-300 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
                <div className="absolute left-3 top-3 text-gray-400">
                  {isSearching ? <Loader2 size={20} className="animate-spin"/> : <Search size={20} />}
                </div>
              </div>

              <div className="min-h-[200px]">
                {searchTerm.length < 2 ? (
                  <div className="text-center text-gray-400 mt-10">Type at least 2 characters to search</div>
                ) : searchResults.length === 0 && !isSearching ? (
                  <div className="text-center text-gray-400 mt-10">No users found.</div>
                ) : (
                  <ul className="space-y-2">
                    {searchResults.map((user) => (
                      <li
                        key={user.id}
                        onClick={() => setSelectedUser(user)}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border transition-all ${
                          selectedUser?.id === user.id
                            ? "bg-blue-50 border-blue-500 shadow-sm"
                            : "bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">
                            {user.fname ? user.fname[0].toUpperCase() : "?"}
                          </div>
                          <div className="overflow-hidden">
                            <div className="font-semibold text-gray-800 truncate">
                              {user.name || `${user.fname} ${user.lname}`}
                            </div>
                            <div className="text-sm text-gray-500 truncate">{user.email}</div>
                          </div>
                        </div>
                        {selectedUser?.id === user.id && (
                          <Check size={20} className="text-blue-600" />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                disabled={!selectedUser || isAdding}
                className={`px-5 py-2 rounded-lg flex items-center gap-2 font-medium text-white transition shadow-md ${
                  selectedUser && !isAdding
                    ? "bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                {isAdding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Add {role}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}