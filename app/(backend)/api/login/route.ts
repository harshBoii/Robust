import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { authCookieMaxAge, signSessionToken } from "@/lib/auth/jwt";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

type LoginBody = {
  userName?: string;
  password?: string;
};

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userName =
    typeof body.userName === "string" ? body.userName.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!userName || !password) {
    return NextResponse.json(
      { error: "userName and password are required" },
      { status: 400 },
    );
  }

  if (userName.length > 255 || password.length > 1024) {
    return NextResponse.json({ error: "Payload too large" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { userName },
    select: {
      id: true,
      name: true,
      slug: true,
      userName: true,
      password: true,
      email: true,
      logoUrl: true,
      subscriptionStatus: true,
      createdAt: true,
    },
  });

  const passwordHash = company?.password ?? null;
  if (!company || !passwordHash) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    );
  }

  const ok = await verifyPassword(password, passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    );
  }

  let token: string;
  try {
    token = await signSessionToken({
      companyId: company.id,
      userName: company.userName ?? userName,
      slug: company.slug,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Authentication is not configured correctly" },
      { status: 500 },
    );
  }

  const res = NextResponse.json({
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      userName: company.userName,
      email: company.email,
      logoUrl: company.logoUrl,
      subscriptionStatus: company.subscriptionStatus,
      createdAt: company.createdAt,
    },
  });

  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: authCookieMaxAge(),
  });

  return res;
}
