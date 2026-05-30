import { NextResponse } from "next/server";
import type { SocialProvider } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { isSocialOAuthConfigured } from "@/lib/auth/social-oauth-state";

const PROVIDERS: SocialProvider[] = ["X", "LINKEDIN", "REDDIT"];

export async function GET() {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  const integrations = await prisma.socialIntegration.findMany({
    where: { companyId: session.companyId },
    select: {
      provider: true,
      accountHandle: true,
      expiresAt: true,
      updatedAt: true,
    },
  });

  const byProvider = Object.fromEntries(integrations.map((i) => [i.provider, i]));

  return NextResponse.json({
    success: true,
    providers: PROVIDERS.map((provider) => ({
      provider,
      connected: Boolean(byProvider[provider]),
      accountHandle: byProvider[provider]?.accountHandle ?? null,
      expiresAt: byProvider[provider]?.expiresAt ?? null,
      oauthConfigured: isSocialOAuthConfigured(provider),
    })),
  });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
  }

  let body: { provider?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const provider = body.provider as SocialProvider | undefined;
  if (!provider || !PROVIDERS.includes(provider)) {
    return NextResponse.json({ success: false, error: "Invalid provider" }, { status: 400 });
  }

  await prisma.socialIntegration.deleteMany({
    where: { companyId: session.companyId, provider },
  });

  return NextResponse.json({ success: true });
}
