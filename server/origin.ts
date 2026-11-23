import { SITE_URL } from "../src/content/site";

const ALLOWED_DEV = /^http:\/\/(localhost|127\.0\.0\.1):\d{2,5}$/;

/**
 * Only pages on the site may open rooms (stops other sites driving a visitor's browser into
 * them). Same-origin requests pass; localhost only when the dev flag is set.
 */
export function originAllowed(origin: string | null, requestUrl: string, dev: boolean): boolean {
  if (!origin) return false;
  if (origin === SITE_URL || origin === new URL(requestUrl).origin) return true;
  return dev && ALLOWED_DEV.test(origin);
}
