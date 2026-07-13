const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

if (!process.env.S3_BUCKET_NAME) {
  throw new Error("S3_BUCKET_NAME is not set.");
}

const BUCKET = process.env.S3_BUCKET_NAME;

// Uses the standard AWS credential chain — env vars (AWS_ACCESS_KEY_ID /
// AWS_SECRET_ACCESS_KEY), a shared credentials file, or an IAM role if
// you're running this on EC2/ECS/Lambda. No need to hardcode keys.
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

async function uploadToS3(key, buffer, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType
  }));
}

async function deleteFromS3(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// The bucket is kept private; we hand out short-lived signed URLs for
// posters/video instead of making objects public.
async function getSignedGetUrl(key, expiresInSeconds = 3600) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}

module.exports = { uploadToS3, deleteFromS3, getSignedGetUrl, BUCKET };