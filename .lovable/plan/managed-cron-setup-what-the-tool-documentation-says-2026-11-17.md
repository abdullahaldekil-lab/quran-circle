# Managed cron setup: what the tool documentation says

Read-only findings. Nothing was written, deployed, scheduled or run.

## 1. Callback header and how LOVABLE_CRON_SECRET is checked
- The docs say managed schedule requests carry "the managed bearer credential", which points to the `Authorization: Bearer ...` header.
- Handlers are supposed to call `authenticateCronRequest(request)` first and return its failure response if it rejects the call.
- Not documented: the exact comparison method, and whether the publishable `apikey` header is also sent. The repair said it would add any missing helper, but no helper file appeared in the project, so its source can't be inspected.
- That helper rejects the publishable key. So the five functions' shared cron check cannot simply require `x-cron-secret === CRON_SECRET` for managed calls.

## 2. Scheduling tools
- **create_http_schedule** — fields: `name` (1–128 characters), `schedule` (five-field cron), `target_path` (the Edge Function name on this classic app), `body` (static JSON object). There is no active/inactive setting, so creating a paused schedule is not supported.
- **update_http_schedule** — fields: `job_id`, `expected_name`, `schedule`, `target_path`, `body`. It works only after checking the managed marker and the exact stored command, so it cannot update a legacy unmanaged job.
- **list_http_schedules** — no fields. Returns id, name, schedule and active state. Managed schedules also show target and body. Job 1 shows no managed metadata.
- **delete_http_schedule** — deletes a managed schedule only, after the same checks.
- **Pausing** — there is no dedicated pause tool. `SELECT cron.alter_job(<id>, active := false|true);` through run_sql is the documented route and works for any job.
- **Migrating a legacy job** — there is no conversion tool. The docs warn against editing unmanaged jobs. The only supported route is: create a new managed schedule, confirm it, then remove the old one with `cron.unschedule(<id>)`.

## 3. Side-effect-free check of the binding
- None is documented. The repair only reports "synchronized". The docs suggest checking an authenticated callback, but that would run the business job. Secret reads are blocked, so equality can't be proven in yes/no form either.
- What can be checked safely: that both secret names exist, the schedule metadata from the listing, and that anonymous and fake-token requests are rejected with 401. Those requests stop at the auth check before any database work.

## 4. Keeping one active */5 job without duplicates
- Pause job 1 with `cron.alter_job(1, active := false)`. Its command and `*/5 * * * *` stay unchanged, so it can be restored.
- Create the managed schedule with the same 5-minute cadence. It can't be created paused, so it starts active, and from then only one active schedule exists.
- The name `staff-attendance-monitor` is already taken by job 1, and the docs don't say whether pg_cron allows a duplicate name. Proposed: a distinct name such as `staff-attendance-monitor-managed`, unless reusing the name is confirmed.
- After the new schedule is confirmed in the listing, remove job 1 with `cron.unschedule(1)`. If anything fails, delete the new schedule and set job 1 back to active.

## Proposed implementation, after approval
1. Shared cron check (both `_shared/cron-auth.ts` and `_shared/notify.ts`): also accept a managed call through `authenticateCronRequest` / `LOVABLE_CRON_SECRET`. Keep the `CRON_SECRET` path and the active-manager path. A bearer prefix alone or a missing secret must still never authorize.
2. Add Deno tests: anonymous, fake bearer, publishable key and wrong secret are all rejected.
3. Deploy the five functions.
4. Switch schedules as in section 4.
5. Check deployed versions, anonymous and fake-token 401s, and the listing. Run no business job with valid credentials.

## Still unknown
- The exact `authenticateCronRequest` source. If the helper can't be generated or found, step 1 is blocked, and nothing gets deployed or switched.
