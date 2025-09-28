-- CreateTable
CREATE TABLE "public"."User" (
    "id" SERIAL NOT NULL,
    "userId" SERIAL NOT NULL,
    "fname" TEXT NOT NULL,
    "lname" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "access_token" TEXT,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "expires_at" INTEGER,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" SERIAL NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Package" (
    "packageId" SERIAL NOT NULL,
    "packageName" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "seats" INTEGER NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("packageId")
);

-- CreateTable
CREATE TABLE "public"."Class" (
    "classId" SERIAL NOT NULL,
    "classname" TEXT NOT NULL,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("classId")
);

-- CreateTable
CREATE TABLE "public"."PackageClass" (
    "packageClassId" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "packageId" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackageClass_pkey" PRIMARY KEY ("packageClassId")
);

-- CreateTable
CREATE TABLE "public"."Lab" (
    "labId" SERIAL NOT NULL,
    "ownerUserId" INTEGER NOT NULL,
    "labname" TEXT NOT NULL,
    "problemSolving" TEXT NOT NULL,
    "inSymVal" INTEGER NOT NULL DEFAULT 0,
    "outSymVal" INTEGER NOT NULL DEFAULT 0,
    "declareSymVal" INTEGER NOT NULL DEFAULT 0,
    "assignSymVal" INTEGER NOT NULL DEFAULT 0,
    "ifSymVal" INTEGER NOT NULL DEFAULT 0,
    "forSymVal" INTEGER NOT NULL DEFAULT 0,
    "whileSymVal" INTEGER NOT NULL DEFAULT 0,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("labId")
);

-- CreateTable
CREATE TABLE "public"."ClassLabs" (
    "classId" INTEGER NOT NULL,
    "labId" INTEGER NOT NULL,

    CONSTRAINT "ClassLabs_pkey" PRIMARY KEY ("classId","labId")
);

-- CreateTable
CREATE TABLE "public"."Testcase" (
    "testcaseId" SERIAL NOT NULL,
    "labId" INTEGER NOT NULL,
    "inputVal" TEXT NOT NULL,
    "outputVal" TEXT NOT NULL,
    "inHiddenVal" TEXT,
    "outHiddenVal" TEXT,
    "score" INTEGER NOT NULL,

    CONSTRAINT "Testcase_pkey" PRIMARY KEY ("testcaseId")
);

-- CreateTable
CREATE TABLE "public"."Submission" (
    "userId" INTEGER NOT NULL,
    "labId" INTEGER NOT NULL,
    "testcaseId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("userId","labId","testcaseId")
);

-- CreateTable
CREATE TABLE "public"."UserClass" (
    "userId" INTEGER NOT NULL,
    "classId" INTEGER NOT NULL,
    "roleId" INTEGER NOT NULL,

    CONSTRAINT "UserClass_pkey" PRIMARY KEY ("userId","classId")
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "roleId" SERIAL NOT NULL,
    "roleName" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("roleId")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "notiId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "createAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("notiId")
);

-- CreateTable
CREATE TABLE "public"."Flowchart" (
    "flowchartId" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "labId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" JSONB NOT NULL,

    CONSTRAINT "Flowchart_pkey" PRIMARY KEY ("flowchartId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userId_key" ON "public"."User"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PackageClass" ADD CONSTRAINT "PackageClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."Class"("classId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PackageClass" ADD CONSTRAINT "PackageClass_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "public"."Package"("packageId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lab" ADD CONSTRAINT "Lab_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassLabs" ADD CONSTRAINT "ClassLabs_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."Class"("classId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ClassLabs" ADD CONSTRAINT "ClassLabs_labId_fkey" FOREIGN KEY ("labId") REFERENCES "public"."Lab"("labId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Testcase" ADD CONSTRAINT "Testcase_labId_fkey" FOREIGN KEY ("labId") REFERENCES "public"."Lab"("labId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_labId_fkey" FOREIGN KEY ("labId") REFERENCES "public"."Lab"("labId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_testcaseId_fkey" FOREIGN KEY ("testcaseId") REFERENCES "public"."Testcase"("testcaseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserClass" ADD CONSTRAINT "UserClass_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserClass" ADD CONSTRAINT "UserClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."Class"("classId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserClass" ADD CONSTRAINT "UserClass_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("roleId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Flowchart" ADD CONSTRAINT "Flowchart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Flowchart" ADD CONSTRAINT "Flowchart_labId_fkey" FOREIGN KEY ("labId") REFERENCES "public"."Lab"("labId") ON DELETE RESTRICT ON UPDATE CASCADE;
