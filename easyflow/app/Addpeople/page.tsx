"use client";
import React, { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import Tabs from "./_components/Tabs";
import AddPersonModal from "./_components/AddPersonModal";
import PeopleList from "./_components/PeopleList";

function Addpeople() {
    const [activeTab, setActiveTab] = useState<string>("Classwork");

  const [teachers, setTeachers] = useState([
    { name: "อ.ปริญญา", email: "parinya@kmitl.ac.th" },
    { name: "อ.ธนา", email: "tana@kmitl.ac.th" },
  ]);
  const [tas, setTAs] = useState([{ name: "TA", email: "ta01@kmitl.ac.th" }]);
  const [classmates, setClassmates] = useState([
    { name: "นิสิต A", email: "stu01@kmitl.ac.th" },
    { name: "นิสิต B", email: "stu02@kmitl.ac.th" },
    { name: "นิสิต C", email: "stu03@kmitl.ac.th" },
  ]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalRole, setModalRole] = useState<"Teacher" | "TA" | "Classmates">("Teacher");

  const openModal = (role: "Teacher" | "TA" | "Classmates") => {
    setModalRole(role);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const getPeople = (role: string) =>
    role === "Teacher" ? teachers : role === "TA" ? tas : classmates;

  const getSetter = (
    role: string
  ): React.Dispatch<
    React.SetStateAction<{ name: string; email: string; position?: string }[]>
  > => (role === "Teacher" ? setTeachers : role === "TA" ? setTAs : setClassmates);

  return (
    <div className="pt-20 min-h-screen bg-gray-100">
      <div className="pl-36">
      <Navbar />
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col px-10 py-10 h-screen w-screen overflow-hidden ">
          <div className="ml-34 mt-10">
          <Tabs activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
          <PeopleList title="Teacher" people={teachers} onAdd={() => openModal("Teacher")} />
          <PeopleList title="TA" people={tas} onAdd={() => openModal("TA")} />
          <PeopleList title="Classmates" people={classmates} onAdd={() => openModal("Classmates")} />

          {/* Modal */}
          <AddPersonModal
            visible={modalOpen}
            onClose={closeModal}
            role={modalRole}
            addedPeople={getPeople(modalRole)}
            setAddedPeople={getSetter(modalRole)}
          />
        </div>
      </div>
    </div>
  </div>
  );
}

export default Addpeople;
