/**
 * Outbound links the game offers.
 *
 * The tip page is public by nature -- it ships inside the page either way -- so it
 * lives here rather than in a secret. Set NEXT_PUBLIC_DONATE_URL to point somewhere
 * else, or to an empty string to drop the link entirely.
 */
const configured = process.env.NEXT_PUBLIC_DONATE_URL;

export const DONATE_URL = (configured === undefined ? "https://paypal.me/mfsafadi" : configured).trim();
