import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError } from "@/lib/api/errors";
import { requireSameOrigin } from "@/lib/api/same-origin";
import { getCurrentUser } from "@/lib/auth/session";
import { updateRuleSchema } from "@/lib/rules/rule-input";
import { deleteRule, setRuleEnabled } from "@/lib/rules/rule-management";

async function authorizedUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Unauthorized");
  return user;
}

type RuleRouteContext = { params: Promise<{ ruleId: string }> };

export async function PATCH(request: Request, context: RuleRouteContext) {
  try {
    requireSameOrigin(request);
    const [user, { ruleId }] = await Promise.all([authorizedUser(), context.params]);
    const input = updateRuleSchema.parse(await request.json());
    await setRuleEnabled(user.id, ruleId, input.isEnabled);
    return NextResponse.json({ updated: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RuleRouteContext) {
  try {
    requireSameOrigin(request);
    const [user, { ruleId }] = await Promise.all([authorizedUser(), context.params]);
    await deleteRule(user.id, ruleId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
