import type { Metadata } from "next";
import App from "@/components/App";
import { I18nProvider } from "@/i18n/I18nProvider";
import { SoundProvider } from "@/lib/sound";

const DESCRIPTION = "One letter, every category, quickest wits win. A party word game for Discord — إنسان، حيوان، نبات، جماد";

/**
 * What Discord and other chat apps show under a shared link. A room link becomes an
 * invitation: its code in the title and on the preview card.
 */
export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const raw = (await searchParams).room;
  const code = typeof raw === "string" ? raw.toUpperCase() : "";
  const room = /^[A-Z0-9]{4,8}$/.test(code) ? code : null;

  const title = room ? `🎈 Join room ${room} on LetterUp` : "LetterUp — Human, Animal, Plant, Object";
  const description = room ? `You're invited to a LetterUp game. ${DESCRIPTION}` : DESCRIPTION;
  const image = { url: room ? `/api/og?room=${room}` : "/api/og", width: 1200, height: 630, alt: title };

  return {
    title,
    description,
    openGraph: { type: "website", siteName: "LetterUp", title, description, images: [image], url: room ? `/?room=${room}` : "/" },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default function Page() {
  return (
    <I18nProvider>
      <SoundProvider>
        <App />
      </SoundProvider>
    </I18nProvider>
  );
}
