import App from "@/components/App";
import { I18nProvider } from "@/i18n/I18nProvider";
import { SoundProvider } from "@/lib/sound";

export default function Page() {
  return (
    <I18nProvider>
      <SoundProvider>
        <App />
      </SoundProvider>
    </I18nProvider>
  );
}
