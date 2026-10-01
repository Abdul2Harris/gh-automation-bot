import { NextRequest, NextResponse } from "next/server";
import { deleteCurrentSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  await deleteCurrentSession();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
