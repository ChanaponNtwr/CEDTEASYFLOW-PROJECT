"use client";
import React, { useState } from "react";
import { FaUserPlus, FaRegFileAlt, FaUserCircle, FaCheckCircle } from "react-icons/fa";

type Person = { name: string; email: string; position?: string };

interface AddPersonModalProps {
  visible: boolean;
  onClose: () => void;
  role: "Teacher" | "TA" | "Classmates";
  addedPeople: Person[];
  setAddedPeople: React.Dispatch<React.SetStateAction<Person[]>>;
}

const AddPersonModal: React.FC<AddPersonModalProps> = ({
  visible,
  onClose,
  role,
  addedPeople,
  setAddedPeople,
}) => {
  const [input, setInput] = useState("");

  const peopleSuggestions: Person[] = [
    { name: "นิสิต A", email: "stu01@kmitl.ac.th" },
    { name: "นิสิต B", email: "stu02@kmitl.ac.th" },
    { name: "นิสิต C", email: "stu03@kmitl.ac.th" },
    { name: "อ.ธนา", email: "tana@kmitl.ac.th" },
    { name: "TA", email: "ta01@kmitl.ac.th" },
  ];

  const togglePerson = (person: Person) => {
    const exists = addedPeople.some((p) => p.email === person.email);
    if (exists) {
      setAddedPeople((prev) => prev.filter((p) => p.email !== person.email));
    } else {
      setAddedPeople((prev) => [
        ...prev,
        {
          ...person,
          position:
            role === "Teacher"
              ? "อาจารย์ผู้สอน"
              : role === "TA"
              ? "ผู้ช่วยสอน"
              : "นิสิตในห้อง",
        },
      ]);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm flex items-center justify-center z-[1000]">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-2xl overflow-hidden max-h-[60vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">{`Add a ${role}`}</h2>
          <div onClick={onClose} className="cursor-pointer text-gray-400 hover:text-gray-700">
            ✕
          </div>
        </div>

        {/* Input */}
        <div className="relative mb-4 flex-0">
          <input
            type="email"
            placeholder="Type a name or email"
            className="w-full p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <FaUserPlus
            className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 hover:text-green-800 cursor-pointer"
            onClick={() => {
              if (!input) return;
              togglePerson({ name: input.split("@")[0], email: input });
              setInput("");
            }}
          />
        </div>

        <div className="flex gap-4 flex-1 overflow-hidden">
          {/* Suggestions */}
          <div className="flex-1 overflow-y-auto border-r border-gray-200 pr-2">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Suggestions</h3>
            <div className="space-y-2">
              {peopleSuggestions
                .filter((p) => p.name.includes(input) || p.email.includes(input))
                .map((person, index) => {
                  const isSelected = addedPeople.some((p) => p.email === person.email);
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between px-3 py-2 rounded-md border cursor-pointer ${
                        isSelected ? "bg-green-100 border-green-300" : "hover:bg-gray-100"
                      }`}
                      onClick={() => togglePerson(person)}
                    >
                      <div className="flex items-center space-x-3">
                        <FaUserCircle className="text-gray-500 text-2xl" />
                        <div>
                          <p className="font-medium">{person.name}</p>
                          <p className="text-sm text-gray-600">{person.email}</p>
                        </div>
                      </div>
                      {isSelected && <FaCheckCircle className="text-green-500 text-lg" />}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Added People */}
          <div className="flex-1 overflow-y-auto pl-2">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Added People</h3>
            <div className="space-y-2">
              {addedPeople.length === 0 ? (
                <p className="text-gray-500">No people added yet.</p>
              ) : (
                addedPeople.map((person, i) => (
                  <div key={i} className="flex flex-col rounded p-2 border border-gray-200">
                    <div className="flex items-center space-x-3">
                      <FaUserCircle className="text-gray-500 text-3xl" />
                      <div>
                        <p className="font-semibold">{person.name}</p>
                        <p className="text-gray-600">{person.email}</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400 ml-12">{person.position}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 rounded-full text-gray-700 hover:bg-gray-300 transition-all duration-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-all duration-200 cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPersonModal;
