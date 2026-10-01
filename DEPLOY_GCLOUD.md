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
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (optional fallback; the deployed app now reads the browser key from the server at runtime)
- `AUTH_SESSION_SECRET`
- `AUTH_ALLOWED_EMAIL_DOMAINS`
- `AUTH_ALLOWED_EMAILS`
- `SUPABASE_LEAVE_ATTACHMENTS_BUCKET`
- `SUPABASE_EMPLOYEE_DOCUMENTS_BUCKET`
- `BREVO_API_KEY` (Brevo transactional API key)
- `ucworkhive@gmail.com` must be a verified Brevo sender. The HR email in System Settings is the reply-to address.
- `BREVO_SENDER_NAME` (optional; defaults to WorkHive HRMS)
- `WORKHIVE_PUBLIC_URL` (public HTTPS app URL so emails can load the WorkHive logo)
- `EMAIL_JOBS_SECRET` (random secret for the holiday reminder job)

Apply the Prisma migrations before routing traffic, including the email placeholder and delivery tables:

```bash
npx prisma migrate deploy
```

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
- Configure a Cloud Scheduler HTTP job to `POST https://YOUR_SERVICE_URL/api/jobs/holiday-reminders` daily at 08:00 in `Asia/Manila`, with header `X-Email-Jobs-Secret` set to `EMAIL_JOBS_SECRET`. The job sends reminders for holidays exactly `holidayReminderLead` days away and records each recipient so reruns do not resend successful deliveries.
- The System Settings HR email receives replies and is also shown in the email footer.

## Transactional email triggers

The stored templates are sent through Brevo when these actions complete:

| Template | Trigger |
| --- | --- |
| Job Application Received | Applicant submits an application |
| Interview Invitation / Interview Rescheduled | HR saves an interview schedule |
| Leave Approved / Leave Rejected | HR finalizes a leave request |
| Overtime Approved / Overtime Rejected | HR changes an overtime decision |
| Welcome Email | An admin or HR user creates an account |
| Password Reset | A known active user requests password recovery |
| Upcoming Holiday Reminder | The daily scheduled job reaches the configured lead date |

New custom templates can use the same placeholder sources. They require an application action to call `sendTemplatedEmail` with the template name, recipient, and record IDs or event fields.

