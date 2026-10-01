-- Prevent a matched rule from performing the same action twice for one event.
CREATE UNIQUE INDEX "ActionAttempt_eventId_ruleId_type_key"
ON "ActionAttempt"("eventId", "ruleId", "type");
