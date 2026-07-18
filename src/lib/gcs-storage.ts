import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { APPLICATION_REQUIREMENTS_BUCKET } from "@/lib/employee-document-config";

const execFileAsync = promisify(execFile);

type GoogleRuntimeConfig = {
  bucket: string;
  projectId?: string;
};

type AuthorizedUserCredentials = {
  type: "authorized_user";
  client_id: string;
  client_secret: string;
  refresh_token: string;
  quota_project_id?: string;
};

type ServiceAccountCredentials = {
  type: "service_account";
  client_email: string;
  private_key: string;
  project_id?: string;
};

function getGoogleRuntimeConfig(): GoogleRuntimeConfig {
  return {
    bucket: APPLICATION_REQUIREMENTS_BUCKET,
    projectId: process.env.GCS_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCLOUD_PROJECT,
  };
}

async function getMetadataServerToken() {
  const response = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
    headers: {
      "Metadata-Flavor": "Google",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(1500),
  });

  if (!response.ok) {
    throw new Error("Metadata server token request failed.");
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Metadata server did not return an access token.");
  }

  return payload.access_token;
}

async function getApplicationDefaultCredentialsPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    join(os.homedir(), "AppData", "Roaming", "gcloud", "application_default_credentials.json"),
    join(os.homedir(), ".config", "gcloud", "application_default_credentials.json"),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next credentials location.
    }
  }

  return null;
}

async function getAuthorizedUserToken(credentials: AuthorizedUserCredentials) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      refresh_token: credentials.refresh_token,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Unable to refresh Google Cloud access token from Application Default Credentials.");
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Google OAuth token response did not include an access token.");
  }

  return payload.access_token;
}

async function getApplicationDefaultCredentialsToken() {
  const credentialsPath = await getApplicationDefaultCredentialsPath();
  if (!credentialsPath) {
    throw new Error("Application Default Credentials file was not found.");
  }

  const raw = await readFile(credentialsPath, "utf8");
  const parsed = JSON.parse(raw) as AuthorizedUserCredentials | ServiceAccountCredentials;

  if (parsed.type === "authorized_user") {
    if (!parsed.client_id || !parsed.client_secret || !parsed.refresh_token) {
      throw new Error("Application Default Credentials are incomplete.");
    }

    return getAuthorizedUserToken(parsed);
  }

  throw new Error("Only authorized_user Application Default Credentials are currently supported for local uploads.");
}

async function getGcloudCommandCandidates() {
  const candidates = [
    process.env.GCLOUD_BIN,
    "gcloud.cmd",
    "gcloud",
    process.env.LOCALAPPDATA
      ? join(process.env.LOCALAPPDATA, "Google", "Cloud SDK", "google-cloud-sdk", "bin", "gcloud.cmd")
      : null,
    process.env.ProgramFiles
      ? join(process.env.ProgramFiles, "Google", "Cloud SDK", "google-cloud-sdk", "bin", "gcloud.cmd")
      : null,
  ].filter((value): value is string => Boolean(value));

  const available: string[] = [];

  for (const candidate of candidates) {
    if (candidate === "gcloud" || candidate === "gcloud.cmd") {
      available.push(candidate);
      continue;
    }

    try {
      await access(candidate);
      available.push(candidate);
    } catch {
      // Skip missing candidate paths.
    }
  }

  return Array.from(new Set(available));
}

async function getGcloudCliToken() {
  const commandFiles = await getGcloudCommandCandidates();
  const commandArgs = [
    ["auth", "application-default", "print-access-token"],
    ["auth", "print-access-token"],
  ] as const;

  for (const file of commandFiles) {
    for (const args of commandArgs) {
      try {
        const { stdout } = await execFileAsync(file, args, {
          timeout: 5000,
          windowsHide: true,
        });
        const token = stdout.trim();
        if (token) {
          return token;
        }
      } catch {
        // Try the next available gcloud auth path.
      }
    }
  }

  throw new Error(
    "Unable to obtain Google Cloud credentials. Run `gcloud auth application-default login` on this machine, or attach a Cloud Run service account with Storage Object Creator access to the bucket.",
  );
}

async function getGoogleAccessToken() {
  const config = getGoogleRuntimeConfig();
  const envToken = process.env.GOOGLE_CLOUD_ACCESS_TOKEN?.trim();

  if (envToken) {
    return { token: envToken, config };
  }

  try {
    const token = await getMetadataServerToken();
    return { token, config };
  } catch {
    try {
      const token = await getApplicationDefaultCredentialsToken();
      return { token, config };
    } catch {
      const token = await getGcloudCliToken();
      return { token, config };
    }
  }
}

function sanitizeObjectPathSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._ -]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "applicant";
}

export async function uploadApplicantRequirementsArchive(input: {
  applicantName: string;
  archiveName: string;
  archiveBuffer: Buffer;
}) {
  const { token, config } = await getGoogleAccessToken();
  const safeApplicantName = sanitizeObjectPathSegment(input.applicantName);
  const safeArchiveName = sanitizeObjectPathSegment(input.archiveName.replace(/\.zip$/i, ""));
  const objectPath = `applications/${safeApplicantName}/${Date.now()}-${safeArchiveName}.zip`;
  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(config.bucket)}/o?uploadType=media&name=${encodeURIComponent(objectPath)}`;

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/zip",
      ...(config.projectId ? { "x-goog-project-id": config.projectId } : {}),
    },
    body: input.archiveBuffer,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to upload the requirements archive to Google Cloud Storage.");
  }

  return {
    bucket: config.bucket,
    objectPath,
    fileName: `${safeArchiveName}.zip`,
  };
}

export async function downloadApplicantRequirementsArchive(input: {
  bucket: string;
  objectPath: string;
}) {
  const { token, config } = await getGoogleAccessToken();
  const downloadUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(input.bucket)}/o/${encodeURIComponent(input.objectPath)}?alt=media`;

  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(config.projectId ? { "x-goog-project-id": config.projectId } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Unable to download the requirements archive from Google Cloud Storage.");
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
