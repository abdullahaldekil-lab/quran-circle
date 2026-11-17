export interface CronAuthorization {
  expectedSecret?: string;
  isActiveManager: (token: string) => Promise<boolean>;
}

/** Scheduled jobs require their configured secret; manual runs require a verified manager. */
export async function authorizeCronCall(
  request: Request,
  { expectedSecret, isActiveManager }: CronAuthorization,
): Promise<boolean> {
  if (expectedSecret && request.headers.get("x-cron-secret") === expectedSecret) {
    return true;
  }

  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") || "")?.[1];
  if (!token) return false;

  try {
    return await isActiveManager(token) === true;
  } catch {
    return false;
  }
}
