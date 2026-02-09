"use client";

import React, { useState, useEffect } from "react";
import { X, Search, Plus, Check, Loader2, UserPlus } from "lucide-react";
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

  // Toggle Selection
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
    if (!currentUserId) { alert("Authentication error"); return; }

    let roleIdToSend = 2; // Student
    if (role === "Teacher") roleIdToSend = 1;
    else if (role === "TA") roleIdToSend = 3;

    setIsAdding(true);
    try {
      const promises = selectedUsers.map((user) => 
        apiAddUserToClass(classId, user.id, roleIdToSend, currentUserId)
      );
      await Promise.all(promises);
      if (onUserAdded) onUserAdded(); 
      onClose();
    } catch (err: any) {
      console.error("Failed to add users:", err);
      alert("Error adding some users.");
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
          // FIX: z-[9999] to stay above navbar, inset-0 to cover screen
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div 
            // FIX: Removed unnecessary margins, using flex center from parent
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="px-6 py-5 flex justify-between items-center bg-white">
              <div className="flex items-center gap-3">
                 <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                    <UserPlus size={24} />
                 </div>
                 <div>
                    <h2 className="text-xl font-bold text-gray-800">Add {role}</h2>
                    <p className="text-xs text-gray-500">Invite new members to your class</p>
                 </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition">
                <X size={20} />
              </button>
            </div>

            {/* Search Area */}
            <div className="p-6 pb-0">
               <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search by name or email..." 
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                  {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" size={18} />}
               </div>
            </div>

            {/* List Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-2">
               {/* Selected Users Chips */}
               {selectedUsers.length > 0 && (
                 <div className="mb-4 flex flex-wrap gap-2">
                    {selectedUsers.map(u => (
                      <span key={u.id} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                        {u.name}
                        <button onClick={() => toggleUser(u)} className="ml-1.5 hover:text-blue-900"><X size={14}/></button>
                      </span>
                    ))}
                 </div>
               )}

               {searchTerm.length > 1 && searchResults.length === 0 && !isSearching && (
                 <div className="text-center text-gray-400 py-8">No users found.</div>
               )}

               {searchResults.map((user) => {
                 const isSelected = selectedUsers.some(u => u.id === user.id);
                 return (
                   <div 
                     key={user.id}
                     onClick={() => toggleUser(user)}
                     className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border
                        ${isSelected ? "bg-blue-50 border-blue-200" : "bg-white border-transparent hover:bg-gray-50"}
                     `}
                   >
                      <div className="flex items-center gap-3">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? "bg-blue-200 text-blue-700" : "bg-gray-200 text-gray-600"}`}>
                            {user.name?.charAt(0) || "?"}
                         </div>
                         <div>
                            <p className={`text-sm font-semibold ${isSelected ? "text-blue-800" : "text-gray-800"}`}>{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                         </div>
                      </div>
                      {isSelected ? <Check size={20} className="text-blue-600" /> : <Plus size={20} className="text-gray-300" />}
                   </div>
                 );
               })}
            </div>

            {/* Footer */}
            <div className="p-6 pt-4 border-t border-transparent flex justify-end gap-3 bg-gray-50/50">
              <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors">
                Cancel
              </button>
              <button 
                onClick={handleAddUser}
                disabled={selectedUsers.length === 0 || isAdding}
                className={`px-6 py-2.5 text-sm font-semibold text-white rounded-xl shadow-lg transition-all flex items-center gap-2
                  ${selectedUsers.length > 0 && !isAdding ? "bg-blue-600 hover:bg-blue-700 shadow-blue-200" : "bg-gray-300 cursor-not-allowed shadow-none"}
                `}
              >
                {isAdding && <Loader2 size={16} className="animate-spin" />}
                Add {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ""}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}