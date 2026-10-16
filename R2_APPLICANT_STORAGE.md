# Applicant ZIP storage on Cloudflare R2

New applicant submissions upload one ZIP to the private R2 bucket configured by
`R2_APPLICANT_REQUIREMENTS_BUCKET`. HR downloads ZIPs through the existing staff
route. Records that still point to Google Cloud Storage continue using the GCS
download path until their files are migrated.

## Setup

1. In Cloudflare R2, keep the bucket's default storage class as **Standard** and
   leave public access disabled.
2. Create a bucket-scoped R2 API token with **Object Read & Write** permission.
3. Set these server-side variables in `.env` and in the deployed app:

   ```dotenv
   R2_ACCOUNT_ID="your-cloudflare-account-id"
   R2_ACCESS_KEY_ID="your-r2-access-key-id"
   R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
   R2_APPLICANT_REQUIREMENTS_BUCKET="workhive-applicant-requirements"
   ```

4. Restart or redeploy the app, then submit one test application and confirm HR
   can download its ZIP. Do not remove GCS credentials while older archive
   records still point there.

## Free-tier safeguard

The app lists all objects in this bucket before each new upload and rejects the
upload if it would take the bucket above **8 GB**. A failed usage check also
blocks the upload. This leaves room below R2 Standard's 10 GB-month free storage
allowance. The limit applies only to this bucket and cannot account for other
buckets in the same Cloudflare account, operations by other apps, or simultaneous
uploads from multiple app instances. R2 is usage billed and Cloudflare budget
alerts do not stop charges. Check account-wide usage in Cloudflare Billing.

When the safeguard stops an upload, the applicant submission fails without
saving an incomplete applicant record. HR must free space or choose a paid
storage plan before new applications can be accepted.
