import { ApiError } from "@/lib/api/errors";
import { getServerEnv } from "@/lib/env";

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expectedOrigin = new URL(getServerEnv().APP_URL).origin;

  if (!origin || origin !== expectedOrigin) {
    throw new ApiError(403, "Invalid request origin");
  }
}
