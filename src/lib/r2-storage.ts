import { randomUUID } from "node:crypto";
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Leave room below R2 Standard's 10 GB-month free storage allowance. This is an
// application safeguard, not an account-level billing cap.
const MAX_BUCKET_BYTES = 8_000_000_000;

export class R2StorageLimitError extends Error {}

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_APPLICANT_REQUIREMENTS_BUCKET?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 applicant storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_APPLICANT_REQUIREMENTS_BUCKET.");
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function createR2Client(config: ReturnType<typeof getR2Config>) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function getBucketBytes(client: S3Client, bucket: string) {
  let total = 0;
  let continuationToken: string | undefined;

  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
    }));

    total += (page.Contents ?? []).reduce((sum, object) => sum + (object.Size ?? 0), 0);
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (page.IsTruncated && !continuationToken) {
      throw new Error("Unable to verify R2 bucket storage usage.");
    }
  } while (continuationToken);

  return total;
}

export async function uploadApplicantRequirementsArchiveToR2(input: {
  archiveName: string;
  archiveBuffer: Buffer;
}) {
  const config = getR2Config();
  const client = createR2Client(config);

  try {
    const currentBytes = await getBucketBytes(client, config.bucket);
    if (currentBytes + input.archiveBuffer.length > MAX_BUCKET_BYTES) {
      throw new R2StorageLimitError("Applicant archive storage has reached its free-tier safety limit. Contact HR before submitting another application.");
    }

    // Do not put applicant names in object keys.
    const objectPath = `applications/${randomUUID()}.zip`;
    await client.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectPath,
      Body: input.archiveBuffer,
      ContentType: "application/zip",
      StorageClass: "STANDARD",
    }));

    return { bucket: config.bucket, objectPath, fileName: input.archiveName };
  } finally {
    client.destroy();
  }
}

export async function downloadApplicantRequirementsArchiveFromR2(input: {
  bucket: string;
  objectPath: string;
}) {
  const config = getR2Config();
  if (input.bucket !== config.bucket) {
    throw new Error("Applicant archive bucket does not match the configured R2 bucket.");
  }

  const client = createR2Client(config);
  try {
    const result = await client.send(new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.objectPath,
    }));
    if (!result.Body) {
      throw new Error("R2 returned an empty applicant archive response.");
    }
    return Buffer.from(await result.Body.transformToByteArray());
  } finally {
    client.destroy();
  }
}

export function isR2ApplicantArchive(bucket: string) {
  return Boolean(process.env.R2_APPLICANT_REQUIREMENTS_BUCKET?.trim())
    && bucket === process.env.R2_APPLICANT_REQUIREMENTS_BUCKET?.trim();
}
