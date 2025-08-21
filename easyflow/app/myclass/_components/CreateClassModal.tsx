"use client";
import React from "react";

interface CreateClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (formData: { className: string; section: string; room: string }) => void;
  formData: { className: string; section: string; room: string };
  setFormData: React.Dispatch<React.SetStateAction<{ className: string; section: string; room: string }>>;
}

function CreateClassModal({ isOpen, onClose, onCreate, formData, setFormData }: CreateClassModalProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (formData.className && formData.section && formData.room) {
      onCreate(formData);
    } else {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-md flex items-center justify-center z-[1000]">
      <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl border-2">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Create Class</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-700 mb-1" htmlFor="className">Class Name</label>
            <input
              type="text"
              name="className"
              value={formData.className}
              onChange={handleInputChange}
              placeholder="Class name..."
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1" htmlFor="section">Section</label>
            <input
              type="text"
              name="section"
              value={formData.section}
              onChange={handleInputChange}
              placeholder="Section..."
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1" htmlFor="room">Room</label>
            <input
              type="text"
              name="room"
              value={formData.room}
              onChange={handleInputChange}
              placeholder="Room..."
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <button
            onClick={handleSubmit}
            className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-all duration-200"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateClassModal;