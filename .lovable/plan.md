

# Fix: Enrollment Requests Public Exposure

## Problem
The `enrollment_requests` table has an RLS policy `"Anyone can view own request by phone"` with `TO anon` and `USING (true)`. This means **any unauthenticated user** can read **all** enrollment requests — exposing guardian names, phone numbers, and student data.

The profiles table fix was already applied in a previous migration.

## Solution
Drop the overly permissive anon SELECT policy. The public enrollment form only needs INSERT (which is already handled). Staff already have their own SELECT policies for managing requests.

```sql
DROP POLICY IF EXISTS "Anyone can view own request by phone" ON public.enrollment_requests;
```

No replacement is needed — the existing staff SELECT policies (`"Manager and admin can view enrollment requests"`) already cover legitimate access.

## Files
| Change | Detail |
|--------|--------|
| Migration SQL | Drop the `"Anyone can view own request by phone"` policy |

No code changes needed — the app only reads enrollment requests from authenticated staff pages.

