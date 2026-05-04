import { prisma } from "@/lib/prisma";
import { maybeAnalyzeBulkUpload } from "@/lib/gallery/analyze-bulk";
import { r2 } from "./r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StreamQueuePriority, AssetStatus, StreamQueueStatus  } from "@/app/generated/prisma/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StreamUploadResult {
  streamId: string;
  playbackUrl: string;
  thumbnailUrl: string;
  duration?: number;
  resolution?: string;
}

// ─── Process Queue (for cron job) ─────────────────────────────────────────────

/**
 * Process all pending queue items in a batch (for cron job).
 */
export async function processQueue(batchSize = 5) {
  console.log(`[STREAM QUEUE] Processing batch of ${batchSize} items`);

  const results: StreamUploadResult[] = [];

  for (let i = 0; i < batchSize; i++) {
    try {
      const result = await processNextQueueItem();
      if (!result) break; // No more pending items
      results.push(result);
    } catch (error) {
      console.error(`[STREAM QUEUE] Error processing item ${i + 1}:`, error);
      // Continue with next item
    }
  }

  console.log(`[STREAM QUEUE] Processed ${results.length} items`);
  return results;
}

// ─── Process Next Queue Item ───────────────────────────────────────────────────

/**
 * Picks the next PENDING item (respecting maxAttempts), uploads it to
 * Cloudflare Stream, and updates both the queue row and the Asset row.
 */
export async function processNextQueueItem(): Promise<StreamUploadResult | null> {
  // Fetch next eligible pending item
  const queueItem = await prisma.streamQueue.findFirst({
    where: {
      status: StreamQueueStatus.PENDING,
      // Only pick up items that haven't exhausted their retry budget.
      // We compare attempts < maxAttempts directly (no self-referential field trick).
      attempts: { lt: 3 }, // fallback guard; real cap enforced below via maxAttempts
    },
    orderBy: [
      { priority: "desc" }, // HIGH > NORMAL > LOW (enum order in DB)
      { createdAt: "asc" },
    ],
    include: {
      asset: {
        select: {
          id: true,
          title: true,
          filename: true,
          companyId: true,
          r2Key: true,
          r2Bucket: true,
        },
      },
    },
  });

  if (!queueItem) {
    console.log("[STREAM QUEUE] No pending items");
    return null;
  }

  // Re-check maxAttempts from the row itself (allows per-item override)
  if (queueItem.attempts >= queueItem.maxAttempts) {
    console.log(
      `[STREAM QUEUE] Skipping item ${queueItem.id} — max attempts (${queueItem.maxAttempts}) already reached`
    );
    await prisma.streamQueue.update({
      where: { id: queueItem.id },
      data: { status: StreamQueueStatus.FAILED },
    });
    return null;
  }

  console.log(
    `[STREAM QUEUE] Processing asset ${queueItem.assetId} (Priority: ${queueItem.priority})`
  );

  // Mark as PROCESSING
  await prisma.streamQueue.update({
    where: { id: queueItem.id },
    data: {
      status: StreamQueueStatus.PROCESSING,
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  try {
    // Upload to Cloudflare Stream
    const result = await uploadToCloudflareStream(queueItem);
    console.log("[STREAM QUEUE] Upload result:", result);

    // Update Asset with Stream details
    const updatedAsset = await prisma.asset.update({
      where: { id: queueItem.assetId },
      data: {
        streamId: result.streamId,
        playbackUrl: result.playbackUrl,
        thumbnailUrl: result.thumbnailUrl,
        status: AssetStatus.READY,
        // duration is Int? in schema — Math.round guards against floats from CF API
        duration: result.duration != null ? Math.round(result.duration) : undefined,
        resolution: result.resolution ?? undefined,
      },
      select: { bulkUploadId: true },
    });
    if (updatedAsset.bulkUploadId) {
      void maybeAnalyzeBulkUpload(updatedAsset.bulkUploadId);
    }

    // Mark queue item as COMPLETED
    await prisma.streamQueue.update({
      where: { id: queueItem.id },
      data: {
        status: StreamQueueStatus.COMPLETED,
        streamId: result.streamId,
        completedAt: new Date(),
      },
    });

    console.log(
      `[STREAM QUEUE] Asset ${queueItem.assetId} uploaded successfully. StreamID: ${result.streamId}`
    );

    return result;
  } catch (error) {
    console.error("[STREAM QUEUE ERROR]", error);

    const currentAttempts = queueItem.attempts + 1; // +1 because we already incremented above
    const isFinalAttempt = currentAttempts >= queueItem.maxAttempts;

    // Update queue row
    await prisma.streamQueue.update({
      where: { id: queueItem.id },
      data: {
        status: isFinalAttempt
          ? StreamQueueStatus.FAILED
          : StreamQueueStatus.PENDING,
        lastError: (error as Error).message,
      },
    });

    // If all retries exhausted — mark asset ERROR and record failure metadata
    if (isFinalAttempt) {
      await prisma.asset.update({
        where: { id: queueItem.assetId },
        data: {
          status: AssetStatus.ERROR,
          // metadata is Json in schema — merge safely with a plain object
          metadata: {
            streamUploadError: (error as Error).message,
            failedAt: new Date().toISOString(),
            attempts: currentAttempts,
          },
        },
      });

      console.error(
        `[STREAM QUEUE] Asset ${queueItem.assetId} failed after ${currentAttempts} attempts`
      );
    } else {
      console.log(
        `[STREAM QUEUE] Asset ${queueItem.assetId} will retry (Attempt ${currentAttempts}/${queueItem.maxAttempts})`
      );
    }

    throw error;
  }
}

// ─── Upload to Cloudflare Stream ──────────────────────────────────────────────

/**
 * Generates a short-lived presigned R2 URL then hands it to
 * Cloudflare Stream's copy endpoint.
 */
type StreamQueueWithAsset = {
  assetId: string;
  r2Key: string;
  r2Bucket: string;
  asset: { title: string; filename: string; companyId: string };
};

async function uploadToCloudflareStream(
  queueItem: StreamQueueWithAsset,
): Promise<StreamUploadResult> {
  // 1. Presigned download URL from R2 (valid 1 hour)
  //    r2Key / r2Bucket come from the queue row (copied at enqueue time)
  const getObjectCommand = new GetObjectCommand({
    Bucket: queueItem.r2Bucket,
    Key: queueItem.r2Key,
  });

  const downloadUrl = await getSignedUrl(r2, getObjectCommand, {
    expiresIn: 3600,
  });

  // 2. Upload to Cloudflare Stream via URL copy
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  const streamResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: downloadUrl,
        meta: {
          assetId: queueItem.assetId,
          name: queueItem.asset.title || queueItem.asset.filename,
          companyId: queueItem.asset.companyId,
        },
        requireSignedURLs: false,
        allowedOrigins: [],
        thumbnailTimestampPct: 0.1,
      }),
    }
  );

  if (!streamResponse.ok) {
    const errorData = await streamResponse.json();
    throw new Error(
      `Cloudflare Stream upload failed: ${JSON.stringify(errorData)}`
    );
  }

  const streamData = await streamResponse.json();

  if (!streamData.success) {
    throw new Error(
      `Cloudflare Stream API error: ${JSON.stringify(streamData.errors)}`
    );
  }

  const streamId: string = streamData.result.uid;

  // 3. Fetch full details to get the correct subdomain-based playback URL
  const detailsResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${streamId}`,
    { headers: { Authorization: `Bearer ${apiToken}` } }
  );

  const detailsData = await detailsResponse.json();

  return {
    streamId,
    playbackUrl: detailsData.result.playback.hls,
    thumbnailUrl: detailsData.result.thumbnail,
    // duration from CF is a float (seconds); Asset.duration is Int? — caller rounds it
    duration: detailsData.result.duration,
    resolution: `${detailsData.result.input.width}x${detailsData.result.input.height}`,
  };
}

// ─── Enqueue Asset ────────────────────────────────────────────────────────────

/**
 * Queue an Asset for Cloudflare Stream upload.
 * Assumes the Asset already has `r2Key` and `r2Bucket` set.
 */
export async function enqueueAssetStreamUpload(
  assetId: string,
  priority: StreamQueuePriority = StreamQueuePriority.NORMAL
) {
  try {
    // Idempotency check — don't double-queue
    const existing = await prisma.streamQueue.findFirst({
      where: {
        assetId,
        status: { in: [StreamQueueStatus.PENDING, StreamQueueStatus.PROCESSING] },
      },
    });

    if (existing) {
      console.log(
        `[STREAM QUEUE] Asset ${assetId} already queued (status=${existing.status})`
      );
      return existing;
    }

    // Validate asset exists and has R2 info
    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true, r2Key: true, r2Bucket: true },
    });

    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    if (!asset.r2Key || !asset.r2Bucket) {
      throw new Error(
        `Asset ${assetId} is missing r2Key or r2Bucket — cannot enqueue`
      );
    }

    const queueEntry = await prisma.streamQueue.create({
      data: {
        assetId: asset.id,
        r2Key: asset.r2Key,
        r2Bucket: asset.r2Bucket,
        status: StreamQueueStatus.PENDING,
        priority,
        attempts: 0,
        maxAttempts: 3,
      },
    });

    console.log(
      `[STREAM QUEUE] Asset ${assetId} queued successfully with priority ${priority}`
    );

    // Fire-and-forget immediate processing for HIGH priority
    if (priority === StreamQueuePriority.HIGH) {
      void processNextQueueItem();
    }

    return queueEntry;
  } catch (error) {
    console.error(
      `[STREAM QUEUE ERROR] Failed to queue asset ${assetId}:`,
      (error as Error).message
    );
    throw error;
  }
}