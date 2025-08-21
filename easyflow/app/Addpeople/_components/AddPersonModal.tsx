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
    <div className="fixed inset-0 bg-white/30 backdrop-blur-md flex justify-center items-center z-50">
      <div className="bg-white rounded-lg w-96 p-6 relative shadow-lg max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          className="absolute top-3 right-3 text-gray-600 hover:text-black"
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>

        <h2 className="text-2xl font-bold mb-4">Add a {role.toLowerCase()}</h2>

        {/* Input */}
        <label htmlFor="emailInput" className="block text-lg font-semibold mb-2">
          Email
        </label>
        <div className="relative mb-4">
          <input
            id="emailInput"
            type="email"
            className="w-full border-b-2 border-gray-300 focus:border-blue-500 py-2 pr-10 outline-none"
            placeholder="Type a name or email"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <FaRegFileAlt className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400" />
          <FaUserPlus
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-green-600 hover:text-green-800"
            onClick={() => {
              if (!input) return;
              togglePerson({ name: input.split("@")[0], email: input });
              setInput("");
            }}
          />
        </div>

        {/* Suggestions */}
        <div className="mb-4 space-y-2">
          {peopleSuggestions
            .filter((p) => p.name.includes(input) || p.email.includes(input))
            .map((person, index) => {
              const isSelected = addedPeople.some((p) => p.email === person.email);
              return (
                <div
                  key={index}
                  className={`flex items-center justify-between px-3 py-2 rounded-md border ${
                    isSelected ? "bg-green-100 border-green-300" : "hover:bg-gray-100"
                  } cursor-pointer`}
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

        {/* Added list */}
        <div className="space-y-3 mb-6">
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

        {/* Submit */}
        <button
          className="block mx-auto px-8 py-2 rounded-full hover:scale-105 bg-blue-500 hover:bg-blue-600 text-white font-semibold"
          onClick={onClose}
        >
          Add
        </button>
      </div>
    </div>
  );
};

export default AddPersonModal;
