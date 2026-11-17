export interface CronAuthorization {
  expectedSecret?: string;
  managedSecret?: string;
  isActiveManager: (token: string) => Promise<boolean>;
}

/** Scheduled jobs require their configured secret; manual runs require a verified manager. */
export async function authorizeCronCall(
  request: Request,
  { expectedSecret, managedSecret, isActiveManager }: CronAuthorization,
): Promise<boolean> {
  if (expectedSecret && request.headers.get("x-cron-secret") === expectedSecret) {
    return true;
  }

  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") || "")?.[1];
  if (!token) return false;

  // Lovable's managed scheduler sends its private credential as a bearer token.
  // Its prefix alone never authorizes a call, and an unset secret fails closed.
  if (managedSecret && token === managedSecret) return true;

  try {
    return await isActiveManager(token) === true;
  } catch {
    return false;
  }
}
