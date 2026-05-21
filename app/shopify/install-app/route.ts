import { type NextRequest, NextResponse } from "next/server";

import { IntegrationProvider } from "@/app/generated/prisma/client";
import { getSession } from "@/lib/auth/session";
import { toAbsoluteUrl } from "@/lib/shopify/client";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.companyId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const cms = await prisma.companyIntegrationCms.findUnique({
    where: {
      companyId_provider: {
        companyId: session.companyId,
        provider: IntegrationProvider.Shopify,
      },
    },
    select: { connectUrl: true },
  });

  const installUrl = cms?.connectUrl?.trim()
    ? toAbsoluteUrl(cms.connectUrl, request.url)
    : process.env.SHOPIFY_CONNECT_URL?.trim()
      ? toAbsoluteUrl(process.env.SHOPIFY_CONNECT_URL, request.url)
      : "";

  if (!installUrl) {
    return NextResponse.redirect(
      new URL("/manager/shopify?shopify_error=no_install_url", request.url),
    );
  }

  return NextResponse.redirect(installUrl);
}
