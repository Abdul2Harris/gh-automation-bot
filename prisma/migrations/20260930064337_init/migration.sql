-- CreateEnum
CREATE TYPE "InstallationAccountType" AS ENUM ('USER', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "RuleTrigger" AS ENUM ('ISSUE_OPENED', 'PULL_REQUEST_OPENED', 'PUSH');

-- CreateEnum
CREATE TYPE "RuleMatchField" AS ENUM ('TITLE', 'BODY', 'TITLE_OR_BODY');

-- CreateEnum
CREATE TYPE "AutomationActionType" AS ENUM ('ADD_LABEL', 'COMMENT', 'SLACK_NOTIFICATION');

-- CreateEnum
CREATE TYPE "ActionAttemptStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "githubUserId" BIGINT NOT NULL,
    "login" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubInstallation" (
    "id" TEXT NOT NULL,
    "githubInstallationId" BIGINT NOT NULL,
    "accountId" BIGINT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" "InstallationAccountType" NOT NULL,
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInstallation" (
    "userId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInstallation_pkey" PRIMARY KEY ("userId","installationId")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "githubRepositoryId" BIGINT NOT NULL,
    "installationId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "action" TEXT,
    "installationId" TEXT,
    "repositoryId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "WebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "repositoryId" TEXT,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" "RuleTrigger" NOT NULL,
    "matchField" "RuleMatchField",
    "matchValue" TEXT,
    "actionType" "AutomationActionType" NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionAttempt" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ruleId" TEXT,
    "type" "AutomationActionType" NOT NULL,
    "status" "ActionAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "target" TEXT,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "errorMessage" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ActionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_githubUserId_key" ON "User"("githubUserId");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubInstallation_githubInstallationId_key" ON "GitHubInstallation"("githubInstallationId");

-- CreateIndex
CREATE INDEX "GitHubInstallation_accountId_idx" ON "GitHubInstallation"("accountId");

-- CreateIndex
CREATE INDEX "UserInstallation_installationId_idx" ON "UserInstallation"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_githubRepositoryId_key" ON "Repository"("githubRepositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_fullName_key" ON "Repository"("fullName");

-- CreateIndex
CREATE INDEX "Repository_installationId_idx" ON "Repository"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_deliveryId_key" ON "WebhookEvent"("deliveryId");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventType_receivedAt_idx" ON "WebhookEvent"("eventType", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_installationId_receivedAt_idx" ON "WebhookEvent"("installationId", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_repositoryId_receivedAt_idx" ON "WebhookEvent"("repositoryId", "receivedAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_receivedAt_idx" ON "WebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "AutomationRule_installationId_isEnabled_idx" ON "AutomationRule"("installationId", "isEnabled");

-- CreateIndex
CREATE INDEX "AutomationRule_repositoryId_isEnabled_idx" ON "AutomationRule"("repositoryId", "isEnabled");

-- CreateIndex
CREATE INDEX "AutomationRule_createdById_idx" ON "AutomationRule"("createdById");

-- CreateIndex
CREATE INDEX "ActionAttempt_eventId_attemptedAt_idx" ON "ActionAttempt"("eventId", "attemptedAt");

-- CreateIndex
CREATE INDEX "ActionAttempt_ruleId_attemptedAt_idx" ON "ActionAttempt"("ruleId", "attemptedAt");

-- CreateIndex
CREATE INDEX "ActionAttempt_status_attemptedAt_idx" ON "ActionAttempt"("status", "attemptedAt");

-- AddForeignKey
ALTER TABLE "UserInstallation" ADD CONSTRAINT "UserInstallation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInstallation" ADD CONSTRAINT "UserInstallation_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GitHubInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GitHubInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GitHubInstallation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GitHubInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionAttempt" ADD CONSTRAINT "ActionAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "WebhookEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionAttempt" ADD CONSTRAINT "ActionAttempt_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
