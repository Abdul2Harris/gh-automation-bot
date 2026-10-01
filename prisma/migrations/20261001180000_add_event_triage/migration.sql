CREATE TYPE "TriageStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "TriagePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TABLE "EventTriage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "TriageStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "TriagePriority",
    "summary" TEXT,
    "suggestedLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "githubComment" TEXT,
    "slackMessage" TEXT,
    "model" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "EventTriage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventTriage_eventId_key" ON "EventTriage"("eventId");
CREATE INDEX "EventTriage_status_createdAt_idx" ON "EventTriage"("status", "createdAt");
ALTER TABLE "EventTriage" ADD CONSTRAINT "EventTriage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "WebhookEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
