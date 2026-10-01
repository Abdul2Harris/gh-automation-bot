CREATE TABLE "AutomationRuleAction" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "type" "AutomationActionType" NOT NULL,
    "config" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationRuleAction_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AutomationRuleAction" ("id", "ruleId", "type", "config", "position", "createdAt")
SELECT 'migrated_' || md5(random()::text || clock_timestamp()::text || "id"),
       "id", "actionType", "actionConfig", 0, "createdAt"
FROM "AutomationRule";

ALTER TABLE "ActionAttempt" ADD COLUMN "ruleActionId" TEXT;

UPDATE "ActionAttempt" AS attempt
SET "ruleActionId" = action."id"
FROM "AutomationRuleAction" AS action
WHERE attempt."ruleId" = action."ruleId"
  AND attempt."type" = action."type";

DROP INDEX "ActionAttempt_eventId_ruleId_type_key";
DROP INDEX "ActionAttempt_ruleId_attemptedAt_idx";
ALTER TABLE "ActionAttempt" DROP CONSTRAINT "ActionAttempt_ruleId_fkey";
ALTER TABLE "ActionAttempt" DROP COLUMN "ruleId";

ALTER TABLE "AutomationRule" DROP COLUMN "actionType";
ALTER TABLE "AutomationRule" DROP COLUMN "actionConfig";

CREATE INDEX "AutomationRuleAction_ruleId_position_idx" ON "AutomationRuleAction"("ruleId", "position");
CREATE INDEX "ActionAttempt_ruleActionId_attemptedAt_idx" ON "ActionAttempt"("ruleActionId", "attemptedAt");
CREATE UNIQUE INDEX "ActionAttempt_eventId_ruleActionId_key" ON "ActionAttempt"("eventId", "ruleActionId");

ALTER TABLE "AutomationRuleAction" ADD CONSTRAINT "AutomationRuleAction_ruleId_fkey"
FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActionAttempt" ADD CONSTRAINT "ActionAttempt_ruleActionId_fkey"
FOREIGN KEY ("ruleActionId") REFERENCES "AutomationRuleAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
