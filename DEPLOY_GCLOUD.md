# Google Cloud Run Deployment

This application is prepared for deployment to Google Cloud Run using the included `Dockerfile` and `cloudbuild.yaml`.

## Required environment variables

Set these on the Cloud Run service before routing traffic:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `AUTH_SESSION_SECRET`
- `AUTH_ALLOWED_EMAIL_DOMAINS`
- `AUTH_ALLOWED_EMAILS`
- `SUPABASE_LEAVE_ATTACHMENTS_BUCKET`
- `SUPABASE_EMPLOYEE_DOCUMENTS_BUCKET`

## Build in Cloud Build

```bash
gcloud builds submit --config cloudbuild.yaml
```

## Deploy to Cloud Run

```bash
gcloud run deploy uc-workhive \
  --image gcr.io/PROJECT_ID/uc-workhive:latest \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 8080
```

## Notes

- The container starts with `node server.js` from Next.js standalone output.
- `AUTH_SESSION_SECRET` should be a strong random value.
- For production, prefer storing secrets in Secret Manager and attaching them to Cloud Run instead of entering them manually.
