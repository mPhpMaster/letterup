import type { Metadata } from "next";
import { LegalDocument, type LegalVersion } from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Privacy Policy · Human, Animal, Plant, Object",
  description: "Privacy Policy for the Human, Animal, Plant, Object Discord Activity.",
};

const en: LegalVersion = {
  title: "Privacy Policy",
  updated: "Last updated: September 16, 2026",
  intro:
    "This policy explains what information “Human, Animal, Plant, Object” (“Letter Up”), a Discord Activity, collects when you play, how it is used, and how long it is kept. We collect only what is needed to run the game.",
  sections: [
    {
      heading: "Information we collect",
      body: [
        "Discord profile: when you launch the Activity and approve the sign-in, Discord shares your user ID, username or display name, and avatar with us.",
        "The sign-in also requests Discord's “guilds” permission, but the game never reads or stores your server list. We do not access your email address, messages, friends, or voice.",
        "Game data: the Activity session ID, the host's game settings, the answers you type, votes you cast, your scores, and when you were last active (used to show who is online).",
      ],
    },
    {
      heading: "How we use it",
      body: [
        "Only to run the game: create and sync game sessions, pick the host, show your name and avatar to the players in your session, collect answers, count votes and calculate scores.",
        "We do not sell your information, show ads, or use it for profiling or marketing.",
      ],
    },
    {
      heading: "Who can see it",
      body: [
        "Other players in the same game session can see your name, avatar, answers (after each round ends), votes and scores.",
        "We do not share your information with anyone else, unless required by law.",
      ],
    },
    {
      heading: "Service providers",
      body: [
        "The game is hosted on Vercel, and game data is stored in a Supabase database located in the European Union (Frankfurt). They process data on our behalf to run the service.",
        "The Discord access token issued at sign-in is used once to confirm who you are and is not saved in our database.",
      ],
    },
    {
      heading: "How long we keep it",
      body: [
        "Game sessions that have been inactive for 24 hours are deleted automatically, together with their players, answers, votes and scores.",
        "Our hosting provider may keep short-lived technical logs (such as request errors) for a limited time.",
      ],
    },
    {
      heading: "Your device",
      body: [
        "The game saves your language preference in your browser's local storage. It does not use advertising or tracking cookies.",
      ],
    },
    {
      heading: "Your choices",
      body: [
        "You can stop using the game at any time and remove its authorization in Discord under User Settings → Authorized Apps. Your game data is deleted automatically as described above; contact us if you want it removed sooner.",
      ],
    },
    {
      heading: "Children",
      body: [
        "The game is not directed at children under 13, or under the minimum age to use Discord in their country.",
      ],
    },
    {
      heading: "Changes",
      body: ["We may update this policy. The date above shows the latest version."],
    },
  ],
};

const ar: LegalVersion = {
  title: "سياسة الخصوصية",
  updated: "آخر تحديث: 16 سبتمبر 2026",
  intro:
    "توضّح هذه السياسة المعلومات التي تجمعها لعبة «إنسان، حيوان، نبات، جماد» (Letter Up)، وهي نشاط داخل ديسكورد، أثناء اللعب، وكيف تُستخدم، ومدة الاحتفاظ بها. نحن لا نجمع إلا ما يلزم لتشغيل اللعبة.",
  sections: [
    {
      heading: "المعلومات التي نجمعها",
      body: [
        "ملف ديسكورد: عند تشغيل النشاط والموافقة على تسجيل الدخول، يشارك ديسكورد معنا معرّف المستخدم واسم المستخدم أو الاسم الظاهر والصورة الرمزية.",
        "يطلب تسجيل الدخول أيضًا صلاحية «guilds» في ديسكورد، لكن اللعبة لا تقرأ قائمة خوادمك ولا تحفظها. ولا نصل إلى بريدك الإلكتروني أو رسائلك أو أصدقائك أو صوتك.",
        "بيانات اللعب: معرّف جلسة النشاط، وإعدادات اللعبة التي يختارها المضيف، والإجابات التي تكتبها، والأصوات التي تُدلي بها، ونقاطك، ووقت آخر نشاط لك (لإظهار المتصلين).",
      ],
    },
    {
      heading: "كيف نستخدمها",
      body: [
        "لتشغيل اللعبة فقط: إنشاء جلسات اللعب ومزامنتها، وتحديد المضيف، وعرض اسمك وصورتك للاعبين في جلستك، وجمع الإجابات، وعدّ الأصوات وحساب النقاط.",
        "لا نبيع معلوماتك، ولا نعرض إعلانات، ولا نستخدمها للتنميط أو التسويق.",
      ],
    },
    {
      heading: "من يمكنه رؤيتها",
      body: [
        "يرى اللاعبون الآخرون في نفس الجلسة اسمك وصورتك وإجاباتك (بعد انتهاء كل جولة) وأصواتك ونقاطك.",
        "لا نشارك معلوماتك مع أي جهة أخرى إلا إذا اقتضى القانون ذلك.",
      ],
    },
    {
      heading: "مزوّدو الخدمة",
      body: [
        "تُستضاف اللعبة على Vercel، وتُحفظ بيانات اللعب في قاعدة بيانات Supabase داخل الاتحاد الأوروبي (فرانكفورت). ويعالج هؤلاء البيانات نيابةً عنا لتشغيل الخدمة.",
        "يُستخدم رمز الوصول الذي يصدره ديسكورد عند تسجيل الدخول مرة واحدة للتحقق من هويتك، ولا يُحفظ في قاعدة بياناتنا.",
      ],
    },
    {
      heading: "مدة الاحتفاظ",
      body: [
        "تُحذف جلسات اللعب غير النشطة لمدة 24 ساعة تلقائيًا، مع لاعبيها وإجاباتها وأصواتها ونقاطها.",
        "قد يحتفظ مزوّد الاستضافة بسجلات تقنية قصيرة الأمد (مثل أخطاء الطلبات) لفترة محدودة.",
      ],
    },
    {
      heading: "جهازك",
      body: ["تحفظ اللعبة اللغة التي تختارها في التخزين المحلي لمتصفحك، ولا تستخدم ملفات تعريف ارتباط إعلانية أو للتتبع."],
    },
    {
      heading: "خياراتك",
      body: [
        "يمكنك التوقف عن استخدام اللعبة في أي وقت، وإلغاء صلاحيتها من إعدادات المستخدم في ديسكورد ← التطبيقات المصرّح بها. تُحذف بيانات لعبك تلقائيًا كما هو موضّح أعلاه، وتواصل معنا إن أردت حذفها قبل ذلك.",
      ],
    },
    {
      heading: "الأطفال",
      body: ["اللعبة غير موجّهة للأطفال دون 13 عامًا، أو دون الحد الأدنى لعمر استخدام ديسكورد في بلدهم."],
    },
    {
      heading: "التعديلات",
      body: ["قد نحدّث هذه السياسة، ويبيّن التاريخ أعلاه أحدث نسخة."],
    },
  ],
};

export default function PrivacyPage() {
  return <LegalDocument en={en} ar={ar} />;
}
