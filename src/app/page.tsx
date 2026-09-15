import App from "@/components/App";
import { I18nProvider } from "@/i18n/I18nProvider";

export default function Page() {
  return (
    <I18nProvider>
      <App />
    </I18nProvider>
  );
}
