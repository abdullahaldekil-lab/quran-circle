

# Fix: Restrict Profiles Table Public Access

## Problem
The `profiles` table has a SELECT policy `"Users can view all profiles"` with `USING (true)`, meaning **anyone** — even unauthenticated users — can read all staff names and phone numbers.

## Solution
Replace the policy to require authentication:

```sql
DROP POLICY "Users can view all profiles" ON public.profiles;

CREATE POLICY "Authenticated can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
```

This restricts access to authenticated users only (logged-in staff/users), while still allowing all authenticated users to see profiles (needed for internal app functionality like displaying teacher names, etc.).

## Files
| Change | Detail |
|--------|--------|
| Migration SQL | Drop old policy, create new one with `TO authenticated` |

No code changes needed — the app already requires login.

