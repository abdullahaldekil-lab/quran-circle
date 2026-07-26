// Canonical public registration link.
//
// The URL used to be built inline in more than one page. Keeping it here means the
// QR code and the copy-link button can never point at different paths.

/** Public enrolment form path (unauthenticated route, see src/App.tsx). */
export const ENROLL_PATH = "/enroll";

/** Absolute registration URL for a given origin, e.g. window.location.origin. */
export const enrollUrl = (origin: string): string =>
  `${(origin || "").replace(/\/+$/, "")}${ENROLL_PATH}`;

/** Filename used when the QR image is downloaded. */
export const enrollQrFileName = (): string => "رمز-التسجيل.png";
