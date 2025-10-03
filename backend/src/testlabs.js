// src/testlabs.js
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // mock labs
  const mockLabs = [
    { ownerUserId: 1, labname: "Lab 1 - Intro to Programming", problemSolving: "Basics" },
    { ownerUserId: 1, labname: "Lab 2 - Flowchart Basics", problemSolving: "Flowcharts" },
    { ownerUserId: 2, labname: "Lab 3 - Loops and Conditions", problemSolving: "Loops" },
    { ownerUserId: 2, labname: "Lab 4 - Functions", problemSolving: "Functions" },
    { ownerUserId: 3, labname: "Lab 5 - Arrays", problemSolving: "Arrays" },
  ];

  for (const lab of mockLabs) {
    const exists = await prisma.lab.findFirst({ where: { labname: lab.labname } });
    if (!exists) {
      await prisma.lab.create({ data: lab });
      console.log(`Inserted lab: ${lab.labname}`);
    } else {
      console.log(`Lab already exists: ${lab.labname}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
