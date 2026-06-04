import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { parseAvatarUrl } from "@/utils/parseContributorLink";
import { randomUUID } from "crypto";

const AVATAR_SIZE_LIMIT = parseInt(process.env.AVATAR_SIZE_LIMIT || "1048576", 10); // 1MB default

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "";
const MINIO_BUCKET = process.env.MINIO_BUCKET || "";
const MINIO_USE_SSL = process.env.MINIO_USE_SSL !== "false";

const s3 = MINIO_ENDPOINT
  ? new S3Client({
      endpoint: `${MINIO_USE_SSL ? "https" : "http"}://${MINIO_ENDPOINT}`,
      region: "us-east-1",
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || "",
        secretAccessKey: process.env.MINIO_SECRET_KEY || "",
      },
      forcePathStyle: true,
    })
  : null;

export async function uploadAvatar(file: Blob, userId: number): Promise<string> {
  if (file.size > AVATAR_SIZE_LIMIT) {
    const { FileTooLarge } = await import("../errors");
    throw FileTooLarge();
  }

  if (!s3) {
    throw new Error("Object storage is not configured (MINIO_ENDPOINT missing)");
  }

  const key = `avatar/${userId}/${Date.now()}-${randomUUID().slice(0, 8)}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await s3.send(
    new PutObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type || "image/png",
    }),
  );

  return `${MINIO_USE_SSL ? "https" : "http"}://${MINIO_ENDPOINT}/${MINIO_BUCKET}/${key}`;
}

/**
 * Resolve an avatar field to a full URL.
 * Handles protocol-prefixed strings (qq:, github:, gravatar:, cravatar:),
 * full URLs, and old MinIO UUIDs.
 */
export function resolveAvatarUrl(avatar: string | null): string {
  if (!avatar) return "";

  if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
    return avatar;
  }

  // Protocol-prefixed formats
  if (
    avatar.startsWith("qq:") ||
    avatar.startsWith("github:") ||
    avatar.startsWith("gravatar:") ||
    avatar.startsWith("cravatar:")
  ) {
    return parseAvatarUrl(avatar);
  }

  // Legacy MinIO UUID format
  if (MINIO_ENDPOINT && MINIO_BUCKET) {
    return `https://${MINIO_ENDPOINT}/${MINIO_BUCKET}/avatar/${avatar}`;
  }

  return "";
}

export async function deleteBlob(url: string): Promise<void> {
  if (!s3 || !MINIO_ENDPOINT || !MINIO_BUCKET) return;

  const prefix = `${MINIO_USE_SSL ? "https" : "http"}://${MINIO_ENDPOINT}/${MINIO_BUCKET}/`;
  if (!url.startsWith(prefix)) return;

  const key = url.slice(prefix.length);
  await s3.send(
    new DeleteObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: key,
    }),
  );
}
