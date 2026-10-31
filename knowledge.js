/**
 * Решатель задач: понимает «как / что сделать чтобы…» и собирает шаги.
 * Не хардкодит отдельные продукты — берёт цель из фразы.
 */

import { detectLang, fill } from "./lang.js?v=9";

/** Футбольные вопросы про счёт / эль-класико — без live API */
function tryFootballScore(text, lang) {
  const n = String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е");
  if (!/(счет|счёт|score|результат|матч|играют|сыграл)/.test(n)) return null;

  const real = /реал|real|мадрид|madrid|хала|hala/.test(n);
  const barca = /барса|барселон|barca|barça|barcelona/.test(n);
  if (real && barca) {
    return lang === "en"
      ? "I don’t pull live scores (local Pupik). El Clásico tip: check Sofascore / Flashscore. Classic vibe — Real vs Barça always fire. Want tactics talk instead?"
      : "Живой счёт я не тяну из сети — я локальный. Эль-Класико смотри на Sofascore / Flashscore. Классика: Реал vs Барса всегда горячо. Хочешь тактику или просто поболеть за «Хала Мадрид»?";
  }
  if (/(счет|счёт|score|результат)/.test(n)) {
    return lang === "en"
      ? "No live match feed here. Open Sofascore/Flashscore for the score — or tell me the teams and we’ll talk tactics."
      : "Онлайн-счёт сюда не приходит. Открой Sofascore/Flashscore — или напиши команды, поговорим тактикой.";
  }
  return null;
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s+\-*/%=?.,]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(s) {
  if (!s) return s;
  return s.replace(/(^|[\s\-_/])(\p{L})/gu, (_, a, c) => a + c.toUpperCase());
}

function cleanTarget(raw) {
  return String(raw || "")
    .replace(/^(чтобы|to|the|a|an|мне|нужно|надо)\s+/i, "")
    .replace(/[?!.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Глаголы действия → тип задачи */
const ACTIONS = [
  {
    id: "download",
    verbs: ["скачать", "загрузить", "download", "get"],
  },
  {
    id: "install",
    verbs: ["установить", "поставить", "install", "setup app"],
  },
  {
    id: "register",
    verbs: ["зарегистрироваться", "регистрац", "создать аккаунт", "sign up", "create account", "register"],
  },
  {
    id: "login",
    verbs: ["войти", "логин", "log in", "login", "sign in"],
  },
  {
    id: "fix",
    verbs: ["починить", "исправить", "починить", "fix", "repair", "solve", "решить проблему", "не работает"],
  },
  {
    id: "setup",
    verbs: ["настроить", "настройка", "configure", "set up", "setup"],
  },
  {
    id: "create",
    verbs: ["создать", "сделать", "написать", "create", "write", "build", "make"],
  },
  {
    id: "learn",
    verbs: ["выучить", "научиться", "изучить", "learn", "study"],
  },
  {
    id: "buy",
    verbs: ["купить", "оплатить", "buy", "purchase", "order"],
  },
  {
    id: "send",
    verbs: ["отправить", "послать", "send", "share"],
  },
  {
    id: "delete",
    verbs: ["удалить", "стереть", "delete", "remove", "uninstall"],
  },
  {
    id: "update",
    verbs: ["обновить", "update", "upgrade"],
  },
  {
    id: "find",
    verbs: ["найти", "поискать", "find", "search", "look up"],
  },
];

const STEPS = {
  download: {
    ru: [
      "Открой официальный сайт или магазин приложений для «{target}» (не случайные зеркала).",
      "Выбери свою систему: Windows / macOS / Android / iOS / консоль.",
      "Войди в аккаунт, если просят, и нажми Download / Скачать.",
      "Дождись файла, проверь имя (без странных .exe с левых сайтов).",
      "Запусти установщик или открой приложение и следуй шагам на экране.",
    ],
    en: [
      "Open the official site or app store for “{target}” (avoid random mirrors).",
      "Pick your platform: Windows / macOS / Android / iOS / console.",
      "Sign in if needed, then hit Download.",
      "Wait for the file and check the name (no shady .exe from unknown sites).",
      "Run the installer or open the app and follow on-screen steps.",
    ],
  },
  install: {
    ru: [
      "Скачай «{target}» с официального источника.",
      "Закрой лишние программы, которые могут мешать установке.",
      "Запусти установщик → Далее / Install, путь оставь по умолчанию, если не уверен.",
      "Дождись конца, перезапусти устройство, если попросит.",
      "Открой «{target}» и проверь, что запускается.",
    ],
    en: [
      "Download “{target}” from an official source.",
      "Close apps that might block the installer.",
      "Run the installer → Next / Install; keep the default path if unsure.",
      "Finish the wizard; reboot if asked.",
      "Open “{target}” and confirm it launches.",
    ],
  },
  register: {
    ru: [
      "Зайди на официальную страницу регистрации «{target}».",
      "Введи почту или телефон, придумай пароль (лучше уникальный).",
      "Подтверди код из письма/SMS.",
      "Заполни профиль по минимуму и сохрани.",
      "Сразу включи защиту: 2FA, если есть.",
    ],
    en: [
      "Open the official sign-up page for “{target}”.",
      "Enter email or phone and create a unique password.",
      "Confirm the code from email/SMS.",
      "Fill the profile lightly and save.",
      "Turn on 2FA if available.",
    ],
  },
  login: {
    ru: [
      "Открой страницу входа «{target}».",
      "Введи логин и пароль (проверь раскладку и Caps Lock).",
      "Если не пускает — «Забыли пароль» и сброс по почте.",
      "После входа не сохраняй пароль на чужом устройстве.",
    ],
    en: [
      "Open the “{target}” login page.",
      "Enter username and password (check layout / Caps Lock).",
      "If locked out, use Forgot password and reset via email.",
      "Don’t save the password on a shared device.",
    ],
  },
  fix: {
    ru: [
      "Сформулируй симптом «{target}»: что делал → что ждал → что получил.",
      "Перезапусти программу/устройство и проверь интернет.",
      "Обнови «{target}» или откатить последнее изменение, если после него сломалось.",
      "Поищи точный текст ошибки + название — часто есть готовый фикс.",
      "Если не вышло — сохрани скрин/лог, чтобы не объяснять заново.",
    ],
    en: [
      "State the “{target}” symptom: what you did → expected → got.",
      "Restart the app/device and check the network.",
      "Update “{target}” or undo the last change if it broke after that.",
      "Search the exact error text + product name for a known fix.",
      "If stuck, keep a screenshot/log so you don’t re-explain.",
    ],
  },
  setup: {
    ru: [
      "Открой настройки «{target}».",
      "Сначала базовое: язык, аккаунт, уведомления.",
      "Включи только нужные опции — лишнее потом.",
      "Сохрани и проверь одним тестовым действием.",
    ],
    en: [
      "Open “{target}” settings.",
      "Start with basics: language, account, notifications.",
      "Enable only what you need — extras later.",
      "Save and verify with one test action.",
    ],
  },
  create: {
    ru: [
      "Уточни цель «{target}» в одном предложении: для кого и зачем.",
      "Разбей на 3–5 маленьких шагов (черновик → проверка → готово).",
      "Сделай минимальную версию, не идеал с первого раза.",
      "Проверь результат и поправь одно узкое место.",
      "Сохрани копию / закоммить, чтобы не потерять.",
    ],
    en: [
      "Clarify the goal “{target}” in one line: for whom and why.",
      "Split into 3–5 small steps (draft → check → done).",
      "Ship a minimal version first, not perfection.",
      "Review and fix one weak spot.",
      "Save a copy / commit so you don’t lose it.",
    ],
  },
  learn: {
    ru: [
      "Цель: понять «{target}» на практике, не всё сразу.",
      "Найди один короткий официальный/проверенный гайд.",
      "Повтори руками 20–40 минут без отвлечений.",
      "Сделай крошечный проект-пример по теме.",
      "Запиши 3 вещи, которые ещё путают — это план на завтра.",
    ],
    en: [
      "Goal: learn “{target}” by doing, not everything at once.",
      "Pick one short official/trusted guide.",
      "Practice hands-on for 20–40 minutes.",
      "Build a tiny example project on the topic.",
      "Note 3 confusing bits — that’s tomorrow’s plan.",
    ],
  },
  buy: {
    ru: [
      "Сравни цену «{target}» на официальном сайте и 1–2 крупных магазинах.",
      "Проверь продавца, отзывы и условия возврата.",
      "Оплачивай только защищённым способом (карта/известный кошелёк).",
      "Сохрани чек и письмо-подтверждение.",
    ],
    en: [
      "Compare “{target}” price on the official site and 1–2 big stores.",
      "Check the seller, reviews, and return policy.",
      "Pay with a protected method (card / known wallet).",
      "Keep the receipt and confirmation email.",
    ],
  },
  send: {
    ru: [
      "Подготовь «{target}»: файл/текст, проверка перед отправкой.",
      "Выбери канал (почта, мессенджер, облако) и адресата.",
      "Прикрепи вложение, коротко опиши в сообщении.",
      "Отправь и убедись, что статус «доставлено» / нет ошибки.",
    ],
    en: [
      "Prepare “{target}”: file/text, double-check before sending.",
      "Pick channel (email, chat, cloud) and the recipient.",
      "Attach, add a short note, then send.",
      "Confirm delivered / no error status.",
    ],
  },
  delete: {
    ru: [
      "Найди «{target}» в системе или в аккаунте.",
      "Сделай копию, если может пригодиться.",
      "Удали штатным способом (Удалить / Uninstall), не через случайные чистильщики.",
      "Очисти корзину / подтверди удаление аккаунта, если это оно.",
    ],
    en: [
      "Locate “{target}” on the device or in the account.",
      "Back it up if you might need it.",
      "Remove with the normal Delete / Uninstall flow.",
      "Empty trash / confirm account deletion if that’s the goal.",
    ],
  },
  update: {
    ru: [
      "Открой «{target}» → проверка обновлений или магазин приложений.",
      "Сохрани несохранённую работу.",
      "Установи обновление и дождись конца.",
      "Перезапусти и проверь, что всё открывается.",
    ],
    en: [
      "Open “{target}” → check for updates or the app store.",
      "Save unsaved work.",
      "Install the update and wait it out.",
      "Relaunch and verify it still works.",
    ],
  },
  find: {
    ru: [
      "Сформулируй запрос по «{target}» 3–5 словами + ключевая деталь.",
      "Сначала официальный сайт / доки, потом проверенные гайды.",
      "Сравни 2 источника, если ответы разные.",
      "Сохрани ссылку или заметку с ответом.",
    ],
    en: [
      "Phrase a 3–5 word query for “{target}” plus one key detail.",
      "Start with official docs, then trusted guides.",
      "Cross-check 2 sources if they disagree.",
      "Save the link or a short note with the answer.",
    ],
  },
  generic: {
    ru: [
      "Цель: {goal}",
      "Разбей задачу на шаги: подготовка → действие → проверка.",
      "Сделай первый маленький шаг за 10 минут, без идеала.",
      "Если застрял — уточни, какой именно шаг не выходит, разберём точечно.",
    ],
    en: [
      "Goal: {goal}",
      "Break it down: prepare → act → verify.",
      "Do the first tiny step in 10 minutes; skip perfection.",
      "If stuck, say which step fails — we’ll zoom in.",
    ],
  },
};

const INTRO = {
  ru: "План по задаче «{label}»:",
  en: "Plan for “{label}”:",
};

const UNKNOWN = {
  ru: "Похоже на задачу, но цель размыта. Напиши яснее: «как скачать …», «что сделать чтобы …», «посчитай …» — соберу шаги.",
  en: "Looks like a task, but the goal is fuzzy. Try: “how to download …”, “what do I need to …”, “calculate …” — I’ll build steps.",
};

function formatSteps(lang, actionId, ctx) {
  const pack = STEPS[actionId] || STEPS.generic;
  const lines = (pack[lang] || pack.ru).map((line) => fill(line, ctx));
  const intro = fill(INTRO[lang] || INTRO.ru, {
    label: ctx.label || ctx.target || ctx.goal,
  });
  return [intro, ...lines.map((l, i) => `${i + 1}. ${l}`)].join("\n");
}

const CHAT_ONLY = [
  "как дела",
  "как ты",
  "как жизнь",
  "как сам",
  "как вас",
  "how are you",
  "how r you",
  "how do you do",
  "what s up",
  "whats up",
  "what's up",
];

function isChatOnly(text) {
  const n = normalize(text).replace(/[?!.]+$/g, "").trim();
  if (
    /^(как|how)\s+(у\s+тебя|у\s+вас|your)\s+(настроен|настрой|дела|жизнь|mood|day|vibe)/.test(n) ||
    /^(как|how)\s+(ты|you)\s+(себя\s+)?(чувству|feel)/.test(n) ||
    /настроен\w*\s*\?*$/.test(n) ||
    /как\s+хочешь|как\s+хотите|на\s+твой\s+вкус|your\s+choice|up\s+to\s+you|whatever\s+you/.test(n)
  ) {
    return true;
  }
  return CHAT_ONLY.some(
    (p) => n === p || n.endsWith(" " + p) || (n.includes(p) && n.length <= p.length + 16)
  );
}

function extractHowto(text) {
  const n = normalize(text);
  if (isChatOnly(n)) return null;
  const patterns = [
    /что\s+(?:мне\s+)?(?:надо|нужно)\s+(?:сделать\s+)?чтобы\s+(.+)/i,
    /(?:как\s+мне|как\s+можно)\s+(.+)/i,
    /(?:what\s+do\s+i\s+need\s+to\s+(?:do\s+)?(?:to\s+)?|how\s+(?:do\s+i|can\s+i|to)|help\s+me\s+(?:to\s+)?)\s*(.+)/i,
    /(?:помоги(?:те)?\s+(?:мне\s+)?(?:с|сделать)?\s*)(.+)/i,
    /^как\s+(.+)/i,
  ];
  for (const re of patterns) {
    const m = n.match(re);
    if (m?.[1]) {
      const goal = cleanTarget(m[1]);
      if (isChatOnly("как " + goal) || isChatOnly(goal)) return null;
      return goal;
    }
  }
  return null;
}

function matchAction(blob) {
  const n = normalize(blob);
  // после «чтобы …» важнее глагол цели, не «сделать»
  const afterChtoby = n.split(/\sчтобы\s/).pop();
  const scope = afterChtoby && afterChtoby !== n ? afterChtoby : n;

  let best = null;
  let bestScore = 0;
  for (const action of ACTIONS) {
    for (const v of action.verbs) {
      if (!scope.includes(v) && !n.includes(v)) continue;
      // длинный глагол и «скачать/install» важнее общего «сделать/make»
      let score = v.length;
      if (["create", "make"].includes(action.id) && /чтобы/.test(n)) score -= 8;
      if (scope.includes(v)) score += 4;
      if (score >= bestScore) {
        best = { action, verb: v };
        bestScore = score;
      }
    }
  }
  return best;
}

function targetAfterVerb(blob, verb) {
  const n = normalize(blob);
  const idx = n.indexOf(verb);
  if (idx < 0) return cleanTarget(blob);
  let rest = n.slice(idx + verb.length).trim();
  rest = rest.replace(/^(чтобы|to|the|a|an|мне|нужно|надо)\s+/i, "");
  return cleanTarget(rest) || cleanTarget(blob);
}

function looksLikeTask(text) {
  const n = normalize(text);
  if (isChatOnly(n)) return false;
  return (
    /^(как|что(\s+мне)?(\s+надо|\s+нужно)?|помоги|напиши|создай|сделай|how|what do i|help me|write|make|create)(\s|$)/.test(n) ||
    /(скачать|установить|настроить|починить|исправить|зарегистрир|выучить|купить|удалить|обновить|download|install|fix|configure|learn|buy|delete|update)/.test(
      n
    ) ||
    /чтобы\s+\S+/.test(n)
  );
}

function tryMath(text, lang) {
  const n = normalize(text);
  const m = n.match(
    /(?:посчитай|сколько будет|вычисли|calculate|what is|=)?\s*([-+]?\d+(?:[.,]\d+)?(?:\s*[+\-*/x×:]\s*[-+]?\d+(?:[.,]\d+)?)+)/i
  );
  const exprRaw =
    m?.[1] ||
    n.match(/^[-+]?\d+(?:[.,]\d+)?(?:\s*[+\-*/x×:]\s*[-+]?\d+(?:[.,]\d+)?)+$/)?.[0];
  if (!exprRaw) return null;
  const expr = exprRaw
    .replace(/,/g, ".")
    .replace(/[x×]/g, "*")
    .replace(/:/g, "/")
    .replace(/\s+/g, "");
  if (!/^[-+]?\d+(\.\d+)?([+\-*/][-+]?\d+(\.\d+)?)+$/.test(expr)) return null;
  const parts = expr.match(/[+\-*/]|[-+]?\d+(?:\.\d+)?/g);
  if (!parts) return null;
  const values = [];
  const ops = [];
  for (const p of parts) {
    if ("+-*/".includes(p) && values.length) ops.push(p);
    else values.push(Number(p));
  }
  for (let i = 0; i < ops.length; i++) {
    if (ops[i] === "*" || ops[i] === "/") {
      const r = ops[i] === "*" ? values[i] * values[i + 1] : values[i] / values[i + 1];
      values.splice(i, 2, r);
      ops.splice(i, 1);
      i -= 1;
    }
  }
  let result = values[0];
  for (let i = 0; i < ops.length; i++) {
    result = ops[i] === "+" ? result + values[i + 1] : result - values[i + 1];
  }
  if (!Number.isFinite(result)) return null;
  const nice = Number.isInteger(result) ? String(result) : String(Math.round(result * 1000) / 1000);
  return lang === "en"
    ? `Result: ${exprRaw.replace(/\s+/g, " ")} = ${nice}`
    : `Считаю: ${exprRaw.replace(/\s+/g, " ")} = ${nice}`;
}

function tryTime(text, lang) {
  const n = normalize(text);
  if (!/(который час|сколько время|время сейчас|what time|current time|\btime\b|какая дата|today.?s date|what(?:'s| is) the date)/.test(n)) {
    if (!/^(время|date|дата)$/.test(n)) return null;
  }
  const now = new Date();
  if (lang === "en") {
    return `It’s ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}, ${now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}.`;
  }
  return `Сейчас ${now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}, ${now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}.`;
}

/**
 * Универсальный разбор рабочей задачи.
 */
function isDefinition(text) {
  const n = normalize(text).replace(/[?!.]+$/g, "").trim();
  return /^(что такое|что это за|what is|what s)(?:\s|$)/.test(n);
}

function tryHowtoTask(text, lang) {
  if (isDefinition(text)) return null;
  if (!looksLikeTask(text)) return null;

  const goalBlob = extractHowto(text) || normalize(text);
  const matched = matchAction(goalBlob) || matchAction(text);

  if (!matched) {
    if (!extractHowto(text) && !/\?$/.test(text.trim())) return null;
    const goal = cleanTarget(goalBlob);
    if (!goal || goal.length < 2) return UNKNOWN[lang] || UNKNOWN.ru;
    return formatSteps(lang, "generic", {
      goal: titleCase(goal),
      target: titleCase(goal),
      label: titleCase(goal),
    });
  }

  const targetRaw = targetAfterVerb(goalBlob, matched.verb);
  const target = titleCase(targetRaw || (lang === "en" ? "your goal" : "твоя цель"));
  const label =
    lang === "en"
      ? `${matched.verb} ${targetRaw || "it"}`.trim()
      : `${matched.verb} ${targetRaw || ""}`.trim() || matched.verb;

  return formatSteps(lang, matched.action.id, {
    target,
    goal: titleCase(goalBlob),
    label: titleCase(label),
  });
}

/**
 * @returns {{ answer: string, lang: string } | null}
 */
export function trySolve(text) {
  const lang = detectLang(text);

  const math = tryMath(text, lang);
  if (math) return { answer: math, lang };

  const time = tryTime(text, lang);
  if (time) return { answer: time, lang };

  const foot = tryFootballScore(text, lang);
  if (foot) return { answer: foot, lang };

  const howto = tryHowtoTask(text, lang);
  if (howto) return { answer: howto, lang };

  return null;
}

export { detectLang };
