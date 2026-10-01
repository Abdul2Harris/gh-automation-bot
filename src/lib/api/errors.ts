import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function apiErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request", fields: error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  console.error(
    "Unexpected API failure:",
    error instanceof Error ? error.message : "Unknown error",
  );
  return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
}
