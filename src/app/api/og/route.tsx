import { ImageResponse } from "next/og";

/**
 * The preview card Discord (and every other chat app) shows under a shared link.
 * With ?room=CODE it becomes an invitation to that room.
 */
export const dynamic = "force-dynamic";

const W = 1200;
const H = 630;

const C = {
  cream: "#fdf6ee",
  paper: "#fffdfb",
  ink: "#2a1b3d",
  inkDeep: "#5b4a78",
  brand: "#f25c7a",
  brandDeep: "#c93d5a",
  accent: "#fcc934",
  accentDeep: "#e0a91a",
  mint: "#3ed3a7",
  grape: "#7c4ddf",
  sky: "#3f9bea",
  edge: "#ecdfd0",
};

const CATEGORIES = [
  { emoji: "🧑", label: "Human", bg: "#fde0e6" },
  { emoji: "🐾", label: "Animal", bg: "#d8f6ec" },
  { emoji: "🌿", label: "Plant", bg: "#e9e0fb" },
  { emoji: "📦", label: "Object", bg: "#dcecfb" },
];

// Scattered through the 48px frame around the card, where they stay visible.
const CONFETTI = [
  [70, 12, C.brand, 14],
  [330, 596, C.mint, 12],
  [540, 10, C.sky, 12],
  [820, 598, C.accent, 14],
  [1090, 14, C.grape, 14],
  [1168, 280, C.mint, 12],
  [14, 420, C.accent, 12],
  [960, 8, C.brand, 10],
  [150, 600, C.grape, 10],
  [1150, 590, C.brand, 12],
] as const;

/** Satori needs raw TTF/OTF; Google Fonts serves TTF to clients that don't ask for woff2. */
async function loadFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`,
    ).then((r) => r.text());
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await fetch(url).then((r) => r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("room")?.toUpperCase() ?? "";
  const room = /^[A-Z0-9]{4,8}$/.test(raw) ? raw : null;

  const headline = room ? "You're invited to play!" : "The classic word race";
  const sub = room ? "Tap the link to join the room" : "One letter. Every category. Quickest wits win.";
  const text = `LetterUp${headline}${sub}${room ?? ""}ROOMHumanAnimalPlantObjectL0123456789 ·`;
  const [display, body] = await Promise.all([loadFont("Fredoka", 700, text), loadFont("Nunito", 800, text)]);
  const fonts = [
    ...(display ? [{ name: "Fredoka", data: display, weight: 700 as const, style: "normal" as const }] : []),
    ...(body ? [{ name: "Nunito", data: body, weight: 800 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", background: C.cream, fontFamily: "Nunito", position: "relative" }}>
        {CONFETTI.map(([x, y, color, s], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: s,
              height: s * 1.5,
              borderRadius: 4,
              background: color,
              transform: `rotate(${(i * 37) % 90 - 45}deg)`,
            }}
          />
        ))}

        <div
          style={{
            margin: 48,
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 56,
            padding: "0 64px",
            background: C.paper,
            borderRadius: 48,
            boxShadow: `0 14px 0 ${C.edge}`,
          }}
        >
          {/* Letter tile */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 250,
                height: 250,
                borderRadius: 68,
                background: C.accent,
                boxShadow: `0 20px 0 ${C.accentDeep}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Fredoka",
                fontSize: 170,
                fontWeight: 700,
                color: C.ink,
                transform: "rotate(-4deg)",
              }}
            >
              L
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 18,
                  background: C.brand,
                  boxShadow: `0 5px 0 ${C.brandDeep}`,
                  color: "white",
                  fontFamily: "Fredoka",
                  fontSize: 34,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                L
              </div>
              <div style={{ fontFamily: "Fredoka", fontSize: 64, fontWeight: 700, color: C.ink, letterSpacing: -1 }}>LetterUp</div>
            </div>

            <div style={{ fontFamily: "Fredoka", fontSize: 46, fontWeight: 700, color: C.brand, lineHeight: 1.1 }}>{headline}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#8a7f99" }}>{sub}</div>

            {room ? (
              <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "14px 30px",
                    borderRadius: 999,
                    background: C.ink,
                    boxShadow: `0 8px 0 ${C.inkDeep}`,
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.accent, letterSpacing: 3 }}>ROOM</div>
                  <div style={{ fontFamily: "Fredoka", fontSize: 54, fontWeight: 700, color: "white", letterSpacing: 10 }}>{room}</div>
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 12, marginTop: room ? 18 : 22 }}>
              {CATEGORIES.map((c) => (
                <div
                  key={c.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 18px",
                    borderRadius: 999,
                    background: c.bg,
                    fontSize: 24,
                    fontWeight: 800,
                    color: C.ink,
                  }}
                >
                  <span>{c.emoji}</span>
                  <span>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      // An empty list would replace the built-in fallback font, so only pass real ones.
      ...(fonts.length ? { fonts } : {}),
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400" },
    },
  );
}
