/*
  Warnings:

  - You are about to drop the column `content` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the `Key` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `ciphertext` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ciphertextType` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fromDeviceId` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toDeviceId` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_userId_fkey";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "content",
DROP COLUMN "userId",
ADD COLUMN     "ciphertext" TEXT NOT NULL,
ADD COLUMN     "ciphertextType" INTEGER NOT NULL,
ADD COLUMN     "delivered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fromDeviceId" TEXT NOT NULL,
ADD COLUMN     "toDeviceId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Key";

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "registrationId" INTEGER NOT NULL,
    "identityKey" TEXT NOT NULL,
    "authToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignedPreKey" (
    "id" TEXT NOT NULL,
    "keyId" INTEGER NOT NULL,
    "publicKey" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" TEXT NOT NULL,

    CONSTRAINT "SignedPreKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KyberPreKey" (
    "id" TEXT NOT NULL,
    "keyId" INTEGER NOT NULL,
    "publicKey" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" TEXT NOT NULL,

    CONSTRAINT "KyberPreKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OneTimePreKey" (
    "id" TEXT NOT NULL,
    "keyId" INTEGER NOT NULL,
    "publicKey" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" TEXT NOT NULL,

    CONSTRAINT "OneTimePreKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_authToken_key" ON "Device"("authToken");

-- CreateIndex
CREATE UNIQUE INDEX "Device_userId_deviceId_key" ON "Device"("userId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "SignedPreKey_deviceId_key" ON "SignedPreKey"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "KyberPreKey_deviceId_keyId_key" ON "KyberPreKey"("deviceId", "keyId");

-- CreateIndex
CREATE UNIQUE INDEX "OneTimePreKey_deviceId_keyId_key" ON "OneTimePreKey"("deviceId", "keyId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignedPreKey" ADD CONSTRAINT "SignedPreKey_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KyberPreKey" ADD CONSTRAINT "KyberPreKey_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OneTimePreKey" ADD CONSTRAINT "OneTimePreKey_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_fromDeviceId_fkey" FOREIGN KEY ("fromDeviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_toDeviceId_fkey" FOREIGN KEY ("toDeviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
