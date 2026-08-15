import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { r2 } from "@/lib/cloudfare/r2";
import {
  r2CompanionJpegKey,
  r2ThumbnailsFolderKey,
} from "@/lib/meta/r2-thumbnail-url";
import { prisma } from "@/lib/prisma";

async function deleteStreamVideo(streamId: string): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("Cloudflare Stream credentials are not configured");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${streamId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiToken}` },
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Cloudflare Stream deletion failed (${response.status})`);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const asset = await prisma.asset.findFirst({
    where: { id, companyId: session.companyId },
    select: {
      id: true,
      assetType: true,
      r2Key: true,
      r2Bucket: true,
      streamId: true,
      _count: { select: { adPublishJobs: true } },
    },
  });

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (asset._count.adPublishJobs > 0) {
    return NextResponse.json(
      {
        error:
          "This asset is used by an ad publishing job and cannot be deleted.",
      },
      { status: 409 },
    );
  }

  try {
    const r2Keys =
      asset.assetType === "VIDEO"
        ? [
            asset.r2Key,
            r2CompanionJpegKey(asset.r2Key),
            r2ThumbnailsFolderKey(asset.r2Key),
          ]
        : [asset.r2Key];
    const storageDeletes: Promise<unknown>[] = [
      r2.send(
        new DeleteObjectsCommand({
          Bucket: asset.r2Bucket,
          Delete: {
            Objects: [...new Set(r2Keys)].map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      ),
    ];

    if (asset.streamId) {
      storageDeletes.push(deleteStreamVideo(asset.streamId));
    }

    await Promise.all(storageDeletes);

    await prisma.$transaction(async (tx) => {
      const intelligence = await tx.assetIntelligence.findUnique({
        where: { assetId: asset.id },
        select: { id: true },
      });

      await tx.geoDataSource.updateMany({
        where: { assetId: asset.id },
        data: { assetId: null },
      });
      await tx.aeoPageSource.updateMany({
        where: { assetId: asset.id },
        data: { assetId: null },
      });
      if (intelligence) {
        await tx.aeoPageSource.updateMany({
          where: { intelligenceId: intelligence.id },
          data: { intelligenceId: null },
        });
      }

      await tx.asset.delete({ where: { id: asset.id } });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`[gallery] Failed to delete asset ${asset.id}:`, error);
    return NextResponse.json(
      { error: "Could not delete the asset. Please try again." },
      { status: 500 },
    );
  }
}
