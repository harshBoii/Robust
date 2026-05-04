import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const r2 = new S3Client({
  region: "auto" as string,
  // R2 + AWS SDK v3: virtual-hosted style can yield NoSuchBucket even when the bucket exists.
  // Path-style keeps requests as https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
  endpoint: process.env.R2_ENDPOINT as string, // https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
  },
  forcePathStyle: true,
});

export async function generatePresignedUrl(
  r2Key: string,
  r2Bucket: string,
  expiresIn = 86400
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: r2Bucket,
      Key: r2Key,
    });

    const signedUrl = await getSignedUrl(r2, command, {
      expiresIn, // 24 hours default
    });

    console.log(
      `✅ Generated presigned URL for ${r2Key} (expires in ${expiresIn}s)`
    );
    return signedUrl;
  } catch (error) {
    console.error(
      "❌ Failed to generate presigned URL:",
      (error as Error).message
    );
    throw new Error("Failed to generate secure video URL");
  }
}