import Link from "next/link";

export interface LegalSection {
  heading: string;
  body: string[];
}

export interface LegalVersion {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

/** Static bilingual legal page: English first, Arabic (RTL) below. */
export function LegalDocument({ en, ar }: { en: LegalVersion; ar: LegalVersion }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <nav className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="font-extrabold">Human, Animal, Plant, Object · إنسان، حيوان، نبات، جماد</span>
        <span className="flex gap-3">
          <Link className="text-brand hover:underline" href="/terms">
            Terms · الشروط
          </Link>
          <Link className="text-brand hover:underline" href="/privacy">
            Privacy · الخصوصية
          </Link>
          <a className="text-brand hover:underline" href="#ar" lang="ar">
            العربية
          </a>
        </span>
      </nav>
      <Version doc={en} lang="en" />
      <hr className="my-10 border-line" />
      <Version doc={ar} lang="ar" />
    </main>
  );
}

function Version({ doc, lang }: { doc: LegalVersion; lang: "en" | "ar" }) {
  const contact =
    lang === "en"
      ? CONTACT
        ? `Questions or requests: ${CONTACT}`
        : "Questions or requests: contact the app developer through the app's page in Discord."
      : CONTACT
        ? `للأسئلة أو الطلبات: ${CONTACT}`
        : "للأسئلة أو الطلبات: تواصل مع مطوّر التطبيق عبر صفحة التطبيق في ديسكورد.";
  return (
    <article id={lang} lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} className="card space-y-5 leading-relaxed">
      <header>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{doc.title}</h1>
        <p className="mt-1 text-sm text-muted">{doc.updated}</p>
        <p className="mt-4">{doc.intro}</p>
      </header>
      {doc.sections.map((s, i) => (
        <section key={s.heading}>
          <h2 className="mb-1.5 text-lg font-bold">
            {i + 1}. {s.heading}
          </h2>
          {s.body.map((p) => (
            <p key={p} className="mt-1.5 text-ink/90">
              {p}
            </p>
          ))}
        </section>
      ))}
      <p className="border-t border-line pt-4 text-sm text-muted">{contact}</p>
    </article>
  );
}
