import { type NextRequest, NextResponse } from "next/server";

import {
  isMetaOAuthConfigured,
  META_OAUTH_SCOPES,
  signMetaOAuthState,
} from "@/lib/auth/meta-oauth-state";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const META_OAUTH_DIALOG = "https://www.facebook.com/v21.0/dialog/oauth";

export async function GET(req: NextRequest) {
  if (!isMetaOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/workspace/settings?meta_oauth=config", req.url),
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login?meta_oauth=session", req.url));
  }

  const existing = await prisma.metaIntegration.findUnique({
    where: { companyId: session.companyId },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.redirect(
      new URL("/workspace/settings?meta_oauth=needs_integration", req.url),
    );
  }

  const clientId = process.env.META_APP_ID!.trim();
  const redirectUri = process.env.META_REDIRECT_URI!.trim();
  const state = await signMetaOAuthState(session.companyId);

  const url = new URL(META_OAUTH_DIALOG);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_OAUTH_SCOPES);
  url.searchParams.set("response_type", "code");

  return NextResponse.redirect(url);
}
