import { NextResponse } from "next/server";
import { retryActionAttempt } from "@/lib/actions/retry-action";
import { apiErrorResponse, ApiError } from "@/lib/api/errors";
import { requireSameOrigin } from "@/lib/api/same-origin";
import { getCurrentUser } from "@/lib/auth/session";

type RetryRouteContext = { params: Promise<{ attemptId: string }> };

export async function POST(request: Request, context: RetryRouteContext) {
  try {
    requireSameOrigin(request);
    const user = await getCurrentUser();
    if (!user) throw new ApiError(401, "Unauthorized");
    const { attemptId } = await context.params;
    const status = await retryActionAttempt(user.id, attemptId);
    return NextResponse.json({ status });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
