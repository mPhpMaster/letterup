import type { Metadata } from "next";
import { LegalDocument, type LegalVersion } from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Terms of Service · Human, Animal, Plant, Object",
  description: "Terms of Service for the Human, Animal, Plant, Object Discord Activity.",
};

const en: LegalVersion = {
  title: "Terms of Service",
  updated: "Last updated: September 16, 2026",
  intro:
    "These terms apply to “Human, Animal, Plant, Object” (also called “Letter Up”), a free multiplayer word game that runs as a Discord Activity. By launching or playing the game you agree to these terms.",
  sections: [
    {
      heading: "Eligibility and Discord's rules",
      body: [
        "You must be allowed to use Discord under Discord's Terms of Service, including its minimum age requirement in your country.",
        "Discord's Terms of Service and Community Guidelines continue to apply while you play.",
      ],
    },
    {
      heading: "Your answers",
      body: [
        "Answers you type are shown to the other players in the same game session and are scored by the game and by player votes.",
        "Do not submit content that is illegal, hateful, harassing, sexually explicit, or that shares someone's personal information. The host may rule any answer invalid.",
      ],
    },
    {
      heading: "Fair play",
      body: [
        "Do not cheat, automate play, exploit bugs, attempt to read other players' answers before a round ends, or interfere with the game's servers or other players.",
      ],
    },
    {
      heading: "The service",
      body: [
        "The game is provided free of charge, “as is” and “as available”, without warranties of any kind. We may change, pause or discontinue it at any time.",
        "To the fullest extent permitted by law, we are not liable for any indirect, incidental or consequential damages, or for lost data, arising from your use of the game.",
      ],
    },
    {
      heading: "Suspension",
      body: ["We may restrict or remove access for anyone who breaks these terms or Discord's rules."],
    },
    {
      heading: "Privacy",
      body: ["How we handle your information is described in our Privacy Policy at /privacy."],
    },
    {
      heading: "Changes",
      body: [
        "We may update these terms. The date above shows the latest version. Continuing to play after a change means you accept the updated terms.",
      ],
    },
  ],
};

const ar: LegalVersion = {
  title: "شروط الخدمة",
  updated: "آخر تحديث: 16 سبتمبر 2026",
  intro:
    "تنطبق هذه الشروط على لعبة «إنسان، حيوان، نبات، جماد» (وتُعرف أيضًا باسم Letter Up)، وهي لعبة كلمات مجانية جماعية تعمل كنشاط (Activity) داخل ديسكورد. بتشغيلك اللعبة أو اللعب فيها فإنك توافق على هذه الشروط.",
  sections: [
    {
      heading: "الأهلية وقواعد ديسكورد",
      body: [
        "يجب أن يكون مسموحًا لك باستخدام ديسكورد وفق شروط خدمته، بما في ذلك الحد الأدنى للعمر في بلدك.",
        "تبقى شروط خدمة ديسكورد وإرشادات مجتمعه سارية أثناء اللعب.",
      ],
    },
    {
      heading: "إجاباتك",
      body: [
        "تظهر الإجابات التي تكتبها لبقية اللاعبين في نفس جلسة اللعب، وتُحتسب نقاطها بواسطة اللعبة وتصويت اللاعبين.",
        "لا تُرسل محتوى مخالفًا للقانون أو يحض على الكراهية أو التحرش أو محتوى جنسيًا صريحًا أو معلومات شخصية عن أحد. ويحق للمضيف الحكم على أي إجابة بأنها غير صحيحة.",
      ],
    },
    {
      heading: "اللعب النظيف",
      body: [
        "يُمنع الغش أو اللعب الآلي أو استغلال الأخطاء البرمجية أو محاولة الاطلاع على إجابات الآخرين قبل انتهاء الجولة أو التأثير على خوادم اللعبة أو على اللاعبين الآخرين.",
      ],
    },
    {
      heading: "الخدمة",
      body: [
        "تُقدَّم اللعبة مجانًا «كما هي» و«حسب توفرها» دون أي ضمانات. ويحق لنا تعديلها أو إيقافها مؤقتًا أو نهائيًا في أي وقت.",
        "إلى أقصى حد يسمح به القانون، لا نتحمل مسؤولية أي أضرار غير مباشرة أو عرضية أو تبعية، أو فقدان بيانات، ناتجة عن استخدامك للعبة.",
      ],
    },
    {
      heading: "الإيقاف",
      body: ["يحق لنا تقييد أو منع وصول أي شخص يخالف هذه الشروط أو قواعد ديسكورد."],
    },
    {
      heading: "الخصوصية",
      body: ["توضّح سياسة الخصوصية في الصفحة ‎/privacy كيفية تعاملنا مع معلوماتك."],
    },
    {
      heading: "التعديلات",
      body: [
        "قد نحدّث هذه الشروط، ويبيّن التاريخ أعلاه أحدث نسخة. استمرارك في اللعب بعد التعديل يعني قبولك للشروط المحدّثة.",
      ],
    },
  ],
};

export default function TermsPage() {
  return <LegalDocument en={en} ar={ar} />;
}
