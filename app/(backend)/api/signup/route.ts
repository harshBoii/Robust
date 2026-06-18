import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Direct signup is disabled. Please use the onboarding flow at /signup.",
    },
    { status: 410 },
  );
}
