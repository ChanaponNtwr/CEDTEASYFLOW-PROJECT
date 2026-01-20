"use client";

import React, { useState, useEffect } from "react";
import { X, Search, Plus, Check, Loader2 } from "lucide-react";
import { apiSearchUsers, apiAddUserToClass } from "@/app/service/FlowchartService";
import { motion, AnimatePresence } from "framer-motion";

interface AddPersonModalProps {
  visible: boolean;
  onClose: () => void;
  role: "Teacher" | "TA" | "Students";
  classId: string;
  onUserAdded: () => void;
  currentUserId: number; 
}

export default function AddPersonModal({
  visible,
  onClose,
  role,
  classId,
  onUserAdded,
  currentUserId,
}: AddPersonModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

  // --- Search Logic ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length > 1) {
        setIsSearching(true);
        try {
          // ✅ [แก้ไขจุดที่ 1]: ส่ง classId และ currentUserId ไปด้วย
          const response = await apiSearchUsers(classId, searchTerm, currentUserId);
          
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
  // ✅ [แก้ไขจุดที่ 2]: เพิ่ม dependency ให้ครบ
  }, [searchTerm, classId, currentUserId]);

  // --- Reset Logic ---
  useEffect(() => {
    if (!visible) {
      setSearchTerm("");
      setSearchResults([]);
      setSelectedUsers([]); 
      setIsAdding(false);
    }
  }, [visible]);

  // ฟังก์ชันเลือก/ยกเลิกเลือก User
  const toggleUser = (user: any) => {
    setSelectedUsers((prev) => {
      const exists = prev.find((u) => u.id === user.id);
      if (exists) {
        return prev.filter((u) => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  // --- Add User Logic ---
  const handleAddUser = async () => {
    if (selectedUsers.length === 0 || !classId) return;

    if (!currentUserId) {
        alert("Authentication error: User ID not found.");
        return;
    }

    let roleIdToSend = 2; // Default Student
    if (role === "Teacher") roleIdToSend = 1;
    else if (role === "TA") roleIdToSend = 3;
    else if (role === "Students") roleIdToSend = 2;

    setIsAdding(true);
    try {
      const promises = selectedUsers.map((user) => 
        apiAddUserToClass(classId, user.id, roleIdToSend, currentUserId)
      );

      await Promise.all(promises);
      
      if (onUserAdded) {
        onUserAdded(); 
      }
      onClose();
    } catch (err: any) {
      console.error("Failed to add users:", err);
      alert("Some users might not have been added (already in class or permission issue).");
      if (onUserAdded) onUserAdded(); 
      onClose();
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div 
          className="fixed inset-0 bg-gray-900/20 backdrop-blur-sm flex items-center justify-center z-[1000]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            className="bg-white rounded-xl shadow-2xl w-[500px] overflow-hidden flex flex-col max-h-[90vh]"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-800">Add {role}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition p-1 hover:bg-gray-200 rounded-full">
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 flex-1 overflow-y-auto min-h-[300px]">
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
                  {isSearching ? <Loader2 size={20} className="animate-spin text-blue-500"/> : <Search size={20} />}
                </div>
              </div>
              
              {selectedUsers.length > 0 && (
                <div className="mb-2 text-sm text-blue-600 font-medium">
                  Selected: {selectedUsers.length} people
                </div>
              )}

              <div className="min-h-[200px]">
                {searchTerm.length < 2 ? (
                  <div className="flex flex-col items-center justify-center text-gray-400 mt-10 space-y-2">
                    <Search size={40} className="opacity-20" />
                    <span>Type at least 2 characters to search</span>
                  </div>
                ) : searchResults.length === 0 && !isSearching ? (
                  <div className="text-center text-gray-400 mt-10">No users found.</div>
                ) : (
                  <ul className="space-y-2">
                    {searchResults.map((user) => {
                      const isSelected = selectedUsers.some((u) => u.id === user.id);

                      return (
                        <li
                          key={user.id}
                          onClick={() => toggleUser(user)}
                          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border transition-all ${
                            isSelected
                              ? "bg-blue-50 border-blue-500 shadow-sm"
                              : "bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center gap-3 w-full overflow-hidden">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${isSelected ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-600"}`}>
                              {user.fname ? user.fname[0].toUpperCase() : "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-800 truncate">
                                {user.name || `${user.fname} ${user.lname}`}
                              </div>
                              <div className="text-sm text-gray-500 truncate">{user.email}</div>
                            </div>
                          </div>
                          {isSelected && (
                            <Check size={20} className="text-blue-600 shrink-0 ml-2" />
                          )}
                        </li>
                      );
                    })}
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
                disabled={selectedUsers.length === 0 || isAdding}
                className={`px-5 py-2 rounded-lg flex items-center gap-2 font-medium text-white transition shadow-md ${
                  selectedUsers.length > 0 && !isAdding
                    ? "bg-blue-600 hover:bg-blue-700 hover:shadow-lg"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                {isAdding ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                Add {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ""} {role}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}