# Deployment of the existing application

## Release verification

1. Start from the intended GitHub commit and install with `npm ci` on Node.js 22.
2. Run type checking, lint, tests, and the production build as listed in the README. Review remaining warnings rather than treating a successful build as a complete audit.
3. Record the previous published frontend version and Edge Function version before changing production.
4. Confirm the existing Lovable project is linked to this repository and the intended branch. Merging to GitHub and publishing to the custom domain are separate operations.

The repository currently has verification CI only. A GitHub push or a green check does not prove that `https://quran-circle.enter.com.sa` has been updated.

## Scheduled-function authorization release

The system-audit patch changes the shared authorization helper and these five Edge Functions:

- `check-absence-warnings`
- `award-monthly-badges`
- `student-attendance-monitor`
- `staff-attendance-monitor`
- `task-reminders`

Deploy each function with the updated `_shared/notify.ts` and `_shared/cron-auth.ts` using the existing backend's authorized deployment mechanism. Frontend publishing alone does not deploy this fix. No database migration is introduced by this patch.

Choose the scheduling path supported by the actual backend before deploying. Also verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are available for manual manager authorization.

**Lovable managed schedules:** the platform sends a private managed bearer credential. The shared gate accepts it only when it exactly matches the configured `LOVABLE_CRON_SECRET`. Provision the binding through the platform's supported cron-auth repair and create schedules through its managed HTTP scheduling tools. This path does not require copying a hidden credential into Vault. Missing or incorrect credentials fail closed. The repair does not convert a legacy unmanaged job into a managed job.

When migrating the existing staff job, record its current frequency and active state, pause it, deploy the reviewed secured functions, create one managed schedule for the same target and frequency, verify the managed metadata, then remove the old paused job. Preserve exactly one active schedule. If a step fails, remove any incomplete managed schedule and restore the recorded legacy job state as appropriate; never roll back to insecure authentication. Current frequency is `*/5 * * * *`. Managed schedule creation is active immediately, so do not create it while the legacy job remains active. Do not invoke the business job manually as an authentication test.

**Legacy secret-header schedules:** Edge `CRON_SECRET` must match Vault `cron_secret`, with the expected backend URL configured for the scheduler. Check equality without printing values, and refresh affected job headers after a credential change. Do not assume `public.schedule_edge_function` exists just because an old migration contains it; it is absent from the current managed database. Inspect the actual scheduling tools and functions before changing jobs.

Manual runs require a valid user session and a current, active `manager` profile. Anonymous users, fabricated bearer strings, inactive profiles and other roles must be refused before service-role work begins. A publishable API key is not a managed cron credential.

Test those cases in staging with a no-side-effect delivery configuration. Do not invoke production absence, badge or reminder jobs just to test authentication: successful calls can update records and send real notifications. Confirm scheduled jobs and a manager's manual run in the intended environment before considering this backend release complete.

## Frontend publication and checks

1. Open the existing linked Lovable project and verify that the reviewed commit is loaded.
2. Use its Publish action to update the existing custom domain. Preserve the domain and backend configuration.
3. Confirm the published asset version, then check login, students, circles, attendance, recitation, Madarij and Himmah on the live domain.
4. Verify new plan suggestions in a test environment: two faces produce two pages; fractional targets require explicit surah/ayah endpoints. Confirm failed Madarij writes display an error.
5. Test teacher, guardian, external reviewer and display-only scope separately. A manager navigating pages cannot establish that those roles are correctly restricted.

During the audit, repository metadata advertised push access, but both the GitHub connector's branch creation and a normal Git push dry-run were refused with HTTP 403. No branch, PR or deployment was created. There was also no connected Lovable publishing tool or backend deployment credential. Restore authorized repository write access and platform publication access before releasing; verify the actual published version afterwards.

## Database changes and recovery

Historical migrations exist under `supabase/migrations`, and newer changes under `drizzle/migrations`. Establish the target's applied migration history before running anything. `drizzle/schema.ts` is intentionally empty and is **not** a schema definition of the live database; do not use schema push to synchronize it with production.

For frontend recovery, republish the recorded previous verified version and confirm its assets on the live domain. For the Edge authorization change, prefer fixing configuration or deploying a corrected secured version; reverting the old helper reopens the authorization bypass. This patch needs no data rollback or bulk student-data update.
