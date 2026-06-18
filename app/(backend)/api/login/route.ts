import { AccessStatus } from "@/app/generated/prisma/client";
import { NextResponse } from "next/server";

import { establishSessionResponse } from "@/lib/auth/establish-session";
import { signPendingLoginToken } from "@/lib/auth/pending-login";
import { verifyPassword } from "@/lib/auth/password";
import { getRequestIp, getRequestUserAgent } from "@/lib/auth/request-meta";
import { logLoginActivity } from "@/lib/auth/session-store";
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
  const ipAddress = getRequestIp(request);
  const userAgent = getRequestUserAgent(request);

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
      accessStatus: true,
      createdAt: true,
      twoFactorEnabled: true,
    },
  });

  const passwordHash = company?.password ?? null;
  if (!company || !passwordHash) {
    await logLoginActivity({
      companyId: company?.id ?? null,
      success: false,
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    );
  }

  const ok = await verifyPassword(password, passwordHash);
  if (!ok) {
    await logLoginActivity({
      companyId: company.id,
      success: false,
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 },
    );
  }

  if (company.accessStatus !== AccessStatus.APPROVED) {
    await logLoginActivity({
      companyId: company.id,
      success: false,
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      {
        error:
          company.accessStatus === AccessStatus.PENDING
            ? "Your access request is pending approval."
            : "Your access request was not approved.",
        accessStatus: company.accessStatus,
      },
      { status: 403 },
    );
  }

  const resolvedUserName = company.userName ?? userName;

  if (company.twoFactorEnabled) {
    try {
      const pendingToken = await signPendingLoginToken({
        companyId: company.id,
        userName: resolvedUserName,
        slug: company.slug,
      });
      return NextResponse.json({
        requires2fa: true,
        pendingToken,
      });
    } catch (err) {
      console.error(err);
      return NextResponse.json(
        { error: "Authentication is not configured correctly" },
        { status: 500 },
      );
    }
  }

  await logLoginActivity({
    companyId: company.id,
    success: true,
    ipAddress,
    userAgent,
  });

  try {
    return await establishSessionResponse({
      companyId: company.id,
      userName: resolvedUserName,
      slug: company.slug,
      userAgent,
      ipAddress,
      body: {
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
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Authentication is not configured correctly" },
      { status: 500 },
    );
  }
}
