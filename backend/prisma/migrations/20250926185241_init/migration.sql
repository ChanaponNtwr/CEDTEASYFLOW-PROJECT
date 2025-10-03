/*
  Warnings:

  - You are about to drop the column `userId` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Account" DROP CONSTRAINT "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Flowchart" DROP CONSTRAINT "Flowchart_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Lab" DROP CONSTRAINT "Lab_ownerUserId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Submission" DROP CONSTRAINT "Submission_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."UserClass" DROP CONSTRAINT "UserClass_userId_fkey";

-- DropIndex
DROP INDEX "public"."User_userId_key";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "userId",
ALTER COLUMN "fname" DROP NOT NULL,
ALTER COLUMN "lname" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lab" ADD CONSTRAINT "Lab_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserClass" ADD CONSTRAINT "UserClass_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Flowchart" ADD CONSTRAINT "Flowchart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
