/**
 * Small inline icon set in the spirit of the mockup's Phosphor icons.
 * Inline SVG rather than the CDN script: Discord's Activity CSP blocks unpkg.
 */
export type IconName =
  | "crown"
  | "user"
  | "users"
  | "userPlus"
  | "userCheck"
  | "globe"
  | "plusCircle"
  | "link"
  | "close"
  | "closeCircle"
  | "trash"
  | "check"
  | "checkCircle"
  | "play"
  | "hourglass"
  | "thumbsUp"
  | "thumbsDown"
  | "sealCheck"
  | "arrowRight"
  | "replay"
  | "discord"
  | "paw"
  | "leaf"
  | "cube"
  | "earth"
  | "bowl"
  | "tag"
  | "buildings"
  | "briefcase"
  | "film"
  | "palette"
  | "ball"
  | "signOut"
  | "share";

const PATHS: Record<IconName, string> = {
  crown: "M3 8l4 3 5-6 5 6 4-3-2 10H5L3 8z",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 20c1.6-3.4 4.5-5 8-5s6.4 1.6 8 5",
  users: "M9 11a3.2 3.2 0 100-6.4A3.2 3.2 0 009 11zM2.5 19.5c1.2-2.8 3.6-4.2 6.5-4.2s5.3 1.4 6.5 4.2M16 11.2a3 3 0 000-6M18 15.6c2 .6 3.3 1.9 4 3.9",
  userPlus: "M10 11.5a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5zM3 20c1.5-3.2 4-4.7 7-4.7 1.2 0 2.3.2 3.3.7M18 14v6M15 17h6",
  userCheck: "M10 11.5a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5zM3 20c1.5-3.2 4-4.7 7-4.7 1 0 2 .2 2.9.5M14.5 17.5l2 2 4-4.5",
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18zM3.5 9h17M3.5 15h17M12 3c2.5 2.4 3.8 5.4 3.8 9S14.5 18.6 12 21c-2.5-2.4-3.8-5.4-3.8-9S9.5 5.4 12 3z",
  plusCircle: "M12 21a9 9 0 100-18 9 9 0 000 18zM8.5 12h7M12 8.5v7",
  link: "M10 13.5a4 4 0 005.7 0l2.8-2.8a4 4 0 10-5.7-5.7l-1.2 1.2M14 10.5a4 4 0 00-5.7 0l-2.8 2.8a4 4 0 105.7 5.7l1.2-1.2",
  close: "M6 6l12 12M18 6L6 18",
  closeCircle: "M12 21a9 9 0 100-18 9 9 0 000 18zM9 9l6 6M15 9l-6 6",
  trash: "M4.5 7h15M9.5 7V5.5A1.5 1.5 0 0111 4h2a1.5 1.5 0 011.5 1.5V7M6.5 7l.8 12.1A1.5 1.5 0 008.8 20.5h6.4a1.5 1.5 0 001.5-1.4L17.5 7M10 11v6M14 11v6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  checkCircle: "M12 21a9 9 0 100-18 9 9 0 000 18zM8 12.2l2.8 2.8L16 9.6",
  play: "M8 5.5l10 6.5-10 6.5v-13z",
  hourglass: "M7 3.5h10M7 20.5h10M7.5 3.5c0 4 4.5 5.3 4.5 8.5s-4.5 4.5-4.5 8.5M16.5 3.5c0 4-4.5 5.3-4.5 8.5s4.5 4.5 4.5 8.5",
  thumbsUp: "M7 10.5v9M3.5 11.5h3.5v8H3.5a.5.5 0 01-.5-.5v-7a.5.5 0 01.5-.5zM7 11l3.6-7.2a2 2 0 013.7 1.4L13.5 9H19a2 2 0 011.9 2.6l-2 6.5a2 2 0 01-1.9 1.4H7",
  thumbsDown: "M7 13.5v-9M3.5 12.5h3.5v-8H3.5a.5.5 0 00-.5.5v7a.5.5 0 00.5.5zM7 13l3.6 7.2a2 2 0 003.7-1.4L13.5 15H19a2 2 0 001.9-2.6l-2-6.5A2 2 0 0017 4.5H7",
  sealCheck: "M12 3l2.3 1.8 2.9-.3 1 2.7 2.5 1.5-.8 2.8.8 2.8-2.5 1.5-1 2.7-2.9-.3L12 21l-2.3-1.8-2.9.3-1-2.7L3.3 15l.8-2.8-.8-2.8 2.5-1.5 1-2.7 2.9.3L12 3zM8.6 12.3l2.4 2.4 4.4-4.9",
  arrowRight: "M4.5 12h14M13 6.5l6 5.5-6 5.5",
  replay: "M20 12a8 8 0 11-2.6-5.9M20 4v4.5h-4.5",
  discord: "M8.5 16.5c-2-1-3.3-3.2-3.5-6 1.3-1.2 3-2 4.8-2.2l.7 1.3c1-.2 2-.2 3 0l.7-1.3c1.8.2 3.5 1 4.8 2.2-.2 2.8-1.5 5-3.5 6M9.7 13.2a1 1 0 100-2 1 1 0 000 2zM14.3 13.2a1 1 0 100-2 1 1 0 000 2z",
  paw: "M7 9.5a1.8 1.8 0 100-3.5 1.8 1.8 0 000 3.5zM17 9.5a1.8 1.8 0 100-3.5 1.8 1.8 0 000 3.5zM4.6 14.4a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2zM19.4 14.4a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2zM12 19.5c-2.6 0-4.2-1.3-4.2-3 0-1.9 1.9-3.6 4.2-3.6s4.2 1.7 4.2 3.6c0 1.7-1.6 3-4.2 3z",
  leaf: "M5 19c0-7 4.5-12 15-12 0 8-4.5 12-11 12H5zM8 16c2-3.5 4.5-5.5 8-6.5",
  cube: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4.3 7.6L12 12l7.7-4.4M12 12v9",
  earth: "M12 21a9 9 0 100-18 9 9 0 000 18zM4 10.5c2.4.6 3.2 2 2.6 4.2 1.9.3 2.8 1.3 2.8 3.1M15 3.8c-.6 1.7-.2 2.9 1.2 3.7-.9 1.4-.7 2.5.6 3.4 1 .7 2 .7 3 0",
  bowl: "M3.5 10.5h17c0 5-3.8 8.5-8.5 8.5S3.5 15.5 3.5 10.5zM9 7c0-1.2.6-2 1.5-2.5M13 7.5c.4-1 .2-1.8-.5-2.5",
  tag: "M4 11.5V5.5a1.5 1.5 0 011.5-1.5h6L20 12.5 12.5 20 4 11.5zM8.2 8.2h.01",
  buildings: "M4 20.5V9.5l6-3v14M10 20.5h10V13l-6-2.5M13.5 14.5h3M13.5 17.5h3M6.5 12.5h1M6.5 16h1",
  briefcase: "M3.5 8.5h17v11h-17v-11zM9 8.5V6a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 6v2.5M3.5 13.5c3 1.3 5.8 2 8.5 2s5.5-.7 8.5-2",
  film: "M3.5 5.5h17v13h-17v-13zM8 5.5v13M16 5.5v13M3.5 12h17",
  palette: "M12 20.5c-4.7 0-8.5-3.6-8.5-8.2S7.3 3.5 12 3.5s8.5 3 8.5 7.1c0 2.4-2 3.6-4 3.6h-1.3c-1.2 0-2.2.9-2.2 2 0 1.3.9 1.6.9 2.5 0 1-1 1.8-1.9 1.8zM8 9.5h.01M12 7.5h.01M16 10h.01",
  ball: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 8l3.8 2.8-1.5 4.5h-4.6L8.2 10.8 12 8zM12 3v5M4.2 9.6L8.2 11M19.8 9.6L15.8 11M7.5 19l2.2-3.7M16.5 19l-2.2-3.7",
  signOut: "M14.5 8V5.5A1.5 1.5 0 0013 4H5.5A1.5 1.5 0 004 5.5v13A1.5 1.5 0 005.5 20H13a1.5 1.5 0 001.5-1.5V16M9.5 12h11M17 8.5l3.5 3.5L17 15.5",
  share: "M17 8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM7 14.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17 20.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM9.2 10.9l5.6-2.8M9.2 13.1l5.6 2.8",
};

export function Icon({
  name,
  size = 20,
  className = "",
  strokeWidth = 1.9,
  filled = false,
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
