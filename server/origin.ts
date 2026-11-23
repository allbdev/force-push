import { SITE_URL } from "../src/content/site";

/** Dev only: this computer, or a private-network address so other machines on the LAN can play. */
const ALLOWED_DEV =
  /^http:\/\/(localhost|127\.0\.0\.1|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}):\d{2,5}$/;

/**
 * Only pages on the site may open rooms (stops other sites driving a visitor's browser into
 * them). Same-origin requests pass; localhost and LAN addresses only when the dev flag is set.
 */
export function originAllowed(origin: string | null, requestUrl: string, dev: boolean): boolean {
  if (!origin) return false;
  if (origin === SITE_URL || origin === new URL(requestUrl).origin) return true;
  return dev && ALLOWED_DEV.test(origin);
}
