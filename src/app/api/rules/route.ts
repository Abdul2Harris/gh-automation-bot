import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError } from "@/lib/api/errors";
import { requireSameOrigin } from "@/lib/api/same-origin";
import { getCurrentUser } from "@/lib/auth/session";
import { createRuleSchema } from "@/lib/rules/rule-input";
import { createRule } from "@/lib/rules/rule-management";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Unauthorized");
    const input = createRuleSchema.parse(await request.json());
    const rule = await createRule(user.id, input);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
