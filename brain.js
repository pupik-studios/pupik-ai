/**
 * Pupik AI — локальный диалоговый движок.
 * Болтает + решает понятные задачи; отвечает на языке пользователя.
 */

import { trySolve, detectLang } from "./knowledge.js?v=10";
import { pickLang, fill as fillTpl } from "./lang.js?v=10";
import { fixLayout } from "./layout.js?v=10";
import { wantsImage, extractImagePrompt, wantsCollage } from "./generate.js?v=10";

const STOP = new Set([
  "и", "в", "на", "с", "по", "к", "у", "о", "а", "но", "же", "ли", "бы", "то",
  "это", "как", "что", "или", "для", "из", "за", "от", "до", "не", "да", "нет",
  "the", "a", "an", "to", "of", "in", "on", "is", "it", "and", "or", "for",
]);

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text) {
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function scoreKeywords(toks, keywords) {
  let score = 0;
  for (const k of keywords) {
    if (k.includes(" ")) {
      if (toks.join(" ").includes(k)) score += 2.5;
    } else if (toks.includes(k)) {
      score += 1.4;
    } else if (toks.some((t) => t.startsWith(k) || k.startsWith(t))) {
      score += 0.7;
    }
  }
  return score;
}

function sentiment(text) {
  const n = normalize(text);
  const pos = [
    "класс", "круто", "супер", "люблю", "нравится", "рад", "счастлив", "отлично",
    "хорошо", "спасибо", "благодар", "огонь", "топ", "cool", "great", "love", "thanks", "happy", "nice",
  ];
  const neg = [
    "плохо", "грустн", "устал", "злюсь", "ненавиж", "скучно", "боюсь", "одиноко",
    "бесит", "ужас", "sad", "tired", "angry", "hate", "lonely", "bad", "afraid", "upset",
  ];
  let s = 0;
  for (const p of pos) if (n.includes(p)) s += 1;
  for (const g of neg) if (n.includes(g)) s -= 1;
  return s;
}

const INTENTS = [
  { id: "greet", keys: ["привет", "здравствуй", "хай", "хелло", "доброе", "добрый", "hello", "hi", "hey", "здарова", "салют"], weight: 1.2 },
  { id: "bye", keys: ["пока", "bye", "увидимся", "до свидания", "спокойной", "прощай", "goodbye", "see you"], weight: 1.1 },
  {
    id: "howareyou",
    keys: [
      "как дела", "как ты", "как жизнь", "как сам", "как у тебя", "настрой", "настроен",
      "how are you", "что нового", "your mood", "how is your",
    ],
    weight: 1.3,
  },
  {
    id: "whatever",
    keys: ["как хочешь", "как хотите", "на твой вкус", "сам реши", "your choice", "up to you", "whatever", "you decide"],
    weight: 1.4,
  },
  {
    id: "creator",
    keys: [
      "кто создател", "создатели", "кто создал", "кто сделал", "кто автор", "автор",
      "разработчик", "кто разработал", "who created", "who made", "creator", "creators", "made by",
    ],
    weight: 1.5,
  },
  { id: "name", keys: ["как тебя зовут", "твое имя", "кто ты", "who are you", "что ты такое", "представься", "what are you"], weight: 1.4 },
  { id: "user_name", keys: ["меня зовут", "мое имя", "зови меня", "my name"], weight: 1.1 },
  { id: "help", keys: ["помощь", "что умеешь", "команды", "help", "можешь", "функции", "what can you"], weight: 1.2 },
  { id: "football", keys: ["футбол", "матч", "гол", "клуб", "карьера", "football", "soccer", "fc", "pupik", "trionda", "мяч"], weight: 1.25 },
  { id: "code", keys: ["код", "программ", "javascript", "python", "html", "css", "баг", "vscode", "visual studio", "coding"], weight: 1.2 },
  { id: "joke", keys: ["шутк", "анекдот", "пошути", "смешно", "joke", "tell me a joke"], weight: 1.3 },
  { id: "mood", keys: ["настроен", "чувствую", "грустно", "весело", "устал", "злюсь", "рад", "feeling", "mood"], weight: 1.15 },
  { id: "remember", keys: ["запомни", "помни", "не забывай", "remember"], weight: 1.35 },
  { id: "recall", keys: ["что ты помнишь", "что помнишь", "про меня", "моя память", "recall", "what do you remember"], weight: 1.3 },
  { id: "thanks", keys: ["спасибо", "благодар", "thanks", "thank you", "мерси"], weight: 1.2 },
  { id: "weather_talk", keys: ["погода", "дождь", "снег", "жарко", "холодно", "weather"], weight: 1.1 },
];

/** @type {Record<string, { ru: string[], en: string[] }>} */
const REPLIES = {
  greet: {
    ru: [
      "Привет{nameSuffix}. Я Pupik AI — болтаю и разбираю задачи («как скачать …», «что сделать чтобы …», счёт). Пиши на любом языке — отвечу так же.",
      "Йо{nameSuffix}. Можно просто поболтать или кинуть рабочую задачу своими словами.",
    ],
    en: [
      "Hey{nameSuffix}. I’m Pupik AI — I chat and break down tasks (“how to download …”, “what do I need to …”, math). Match my reply to your language.",
      "Yo{nameSuffix}. Small talk or a real task — both fine.",
    ],
  },
  bye: {
    ru: ["Пока{nameSuffix}. Заглядывай ещё.", "До связи. Память сессии сохраню."],
    en: ["Bye{nameSuffix}. Come back anytime.", "See you. Session memory stays."],
  },
  howareyou: {
    ru: [
      "Настрой бодрый: слушаю, считаю шаги по задачам, готов поболтать. А у тебя{nameSuffix}?",
      "У меня ровно и любопытно. Как ты?",
    ],
    en: [
      "Mood’s good: listening, breaking down tasks, ready to chat. You{nameSuffix}?",
      "Steady and curious over here. How about you?",
    ],
  },
  whatever: {
    ru: [
      "Ок, тогда я выбираю: давай просто поболтаем — или кинь любую задачу «как …».",
      "Договорились, решаю я: расскажи, что сейчас в голове, в одном предложении.",
    ],
    en: [
      "Cool, I’ll pick: either small talk, or throw me a “how to …” task.",
      "Alright — tell me what’s on your mind in one line.",
    ],
  },
  layout_note: {
    ru: ["(понял с раскладки: «{fixed}»)", "ок, это было «{fixed}» — раскладка сбилась"],
    en: ["(read via layout fix: “{fixed}”)", "got it — layout slip, meant “{fixed}”"],
  },
  cleared_chat: {
    ru: ["Беседа сброшена. Можем начать заново."],
    en: ["Conversation cleared. Fresh start."],
  },
  choice: {
    ru: ["Беру «{pick}». Если передумал — скажи.", "Мой выбор: {pick}."],
    en: ["I’ll go with “{pick}”.", "Picking {pick}."],
  },
  short_ack: {
    ru: ["Ок{nameSuffix}.", "Понял.", "Я здесь. Продолжай."],
    en: ["Ok{nameSuffix}.", "Got it.", "I’m here — go on."],
  },
  creator: {
    ru: ["Создатель: Владимиров Роберт Павлович."],
    en: ["Creator: Владимиров Роберт Павлович."],
  },
  name: {
    ru: [
      "Я Pupik AI от Pupik Studios. Создатель — Владимиров Роберт Павлович. Локальный ИИ: общение + задачи + картинки.",
    ],
    en: [
      "I’m Pupik AI from Pupik Studios. Creator — Владимиров Роберт Павлович. Local chat, tasks, and images.",
    ],
  },
  help: {
    ru: [
      "Умею: болтать; задачи; картинки; файлы 📎; режим агента (кнопка «агент» или «запусти критиков») — 3 саб-агента ставят оценку /10. Создатель: Владимиров Роберт Павлович.",
    ],
    en: [
      "Chat, tasks, images, files 📎, agent mode (button or “run critics”) — 3 critic sub-agents score /10. Creator: Владимиров Роберт Павлович.",
    ],
  },
  image_cap: {
    ru: ["Готово — локальная картинка по запросу «{prompt}».", "Нарисовал в движке Pupik: «{prompt}»."],
    en: ["Done — local image for “{prompt}”.", "Painted in Pupik’s engine: “{prompt}”."],
  },
  image_collage: {
    ru: [
      "Собрал коллаж: твоё фото + «{prompt}». Это локальный стиль Pupik, не нейросеть-фейк лиц — но вайб тот.",
    ],
    en: [
      "Collage ready: your photo + “{prompt}”. Local Pupik style, not a deepfake — but the vibe’s there.",
    ],
  },
  image_ask: {
    ru: [
      "Да, умею генерировать картинки локально. Напиши, например: «нарисуй кота» или «сгенерируй закат».",
    ],
    en: ["Yes — I generate images locally. Try: “draw a cat” or “generate a sunset”."],
  },
  file_image: {
    ru: ["Принял картинку «{name}» ({size}). Могу обсудить или нарисовать что-то похожее — скажи тему."],
    en: ["Got image “{name}” ({size}). Want a take on it, or should I draw a theme?"],
  },
  file_text: {
    ru: ["Принял файл «{name}» ({size}). Фрагмент:\n{preview}"],
    en: ["Got file “{name}” ({size}). Preview:\n{preview}"],
  },
  file_other: {
    ru: ["Файл «{name}» получен ({size}, {type}). Содержимое бинарное — скажи, что с ним сделать."],
    en: ["File “{name}” received ({size}, {type}). Binary payload — tell me what you need."],
  },
  football: {
    ru: ["Футбол — родная тема Pupik Studios. Тактика, карьера или просто болтовня — что нужно?"],
    en: ["Football’s home turf for Pupik Studios. Tactics, career chat, or just vibes — your call."],
  },
  code: {
    ru: ["По коду: маленький шаг, ясный симптом бага, один смысл на функцию. Кидай задачу — разложу по шагам."],
    en: ["For code: small steps, clear bug symptom, one job per function. Send the task — I’ll outline steps."],
  },
  joke: {
    ru: [
      "Почему ИИ открыл папку `ai`? Чтобы задачи решать без офсайда.",
      "Баг зашёл в бар. «Ничего не наливайте — я уже воспроизвёлся».",
    ],
    en: [
      "Why did the AI open the `ai` folder? To stay onside with your tasks.",
      "A bug walks into a bar. “Nothing for me — I already reproduced.”",
    ],
  },
  thanks: {
    ru: ["Всегда пожалуйста{nameSuffix}.", "На здоровье."],
    en: ["Anytime{nameSuffix}.", "You got it."],
  },
  weather_talk: {
    ru: ["Погоду с улицы не вижу — я локальный. Зато могу разобрать задачу или поднять настроение."],
    en: ["I can’t see outside weather — I’m local. I can still unpack a task or cheer you up."],
  },
  mood_pos: {
    ru: ["Слышу подъём — кайф. Что дальше?"],
    en: ["Love that energy. What’s next?"],
  },
  mood_neg: {
    ru: ["Похоже, тяжеловато. Рядом. Выговориться или отвлечься задачей?"],
    en: ["Sounds rough. I’m here. Vent, or switch to a concrete task?"],
  },
  mood_neu: {
    ru: ["Ок, ровно. Чем займёмся?"],
    en: ["Got it. What should we tackle?"],
  },
  remember_ok: {
    ru: ["Запомнил: {fact}", "Ок, в память: {fact}"],
    en: ["Got it: {fact}", "Saved: {fact}"],
  },
  recall_empty: {
    ru: ["Память пока пустая. Скажи «запомни …»."],
    en: ["Memory’s empty. Say “remember …”."],
  },
  recall_full: {
    ru: ["Вот что держу:\n{facts}"],
    en: ["Here’s what I keep:\n{facts}"],
  },
  fallback: {
    ru: [
      "Слышу тебя{nameSuffix}. Можем болтать дальше — или кинь задачу вроде «как скачать …».",
      "Ок, держу контекст. Что дальше: шутка, совет или шаги по делу?",
    ],
    en: [
      "Hearing you{nameSuffix}. Keep chatting — or drop a task like “how to download …”.",
      "Got the vibe. Next: joke, advice, or step-by-step?",
    ],
  },
  about_photo: {
    ru: [
      "Фото дошло — вижу файл «{fileName}». Я локальный, лица не распознаю как нейросеть, но картинка в чате есть. Могу нарисовать что-то в футбольном вайбе или просто поболтать про неё.",
      "Да, получилось: файл принят ({fileName}). Если скажешь, кто на фото / что обсудить — продолжим. Или «нарисуй …» — сделаю свою картинку.",
    ],
    en: [
      "Got the photo “{fileName}”. I’m local so I don’t deep-recognize faces, but it’s in the chat. Want a football-style draw, or just talk about it?",
      "Yes — file landed ({fileName}). Tell me what’s on it, or say “draw …” and I’ll paint one.",
    ],
  },
  follow_ok: {
    ru: ["Да, на связи{nameSuffix}. Продолжай.", "Ага, я тут. Кидай мысль."],
    en: ["Yep, still here{nameSuffix}.", "Listening — go ahead."],
  },
  cheer: {
    ru: ["Хала Мадрид{nameSuffix}! ⚪ Что дальше — классико, шутка или картинка?"],
    en: ["Hala Madrid{nameSuffix}! What’s next — Clásico chat, a joke, or a pic?"],
  },
  user_named: {
    ru: ["Приятно, {userName}. Буду так обращаться."],
    en: ["Nice to meet you, {userName}. I’ll use that name."],
  },
  cleared: {
    ru: ["Память очищена. Можем знакомиться заново."],
    en: ["Memory cleared. Fresh start."],
  },
};

function extractName(text) {
  const n = normalize(text);
  const m =
    n.match(/(?:меня зовут|мое имя|зови меня|my name is)\s+([a-zа-яё0-9_-]{2,24})/i) ||
    n.match(/^я\s+([a-zа-яё]{2,24})$/i) ||
    n.match(/^i(?:'m| am)\s+([a-z]{2,24})$/i);
  if (!m) return null;
  const raw = m[1];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function extractRemember(text) {
  const m = text.trim().match(/(?:запомни|помни|не забывай|remember)[:\s]+(.+)/i);
  return m ? m[1].trim() : null;
}

/** «67 или 52» / «чай или кофе» — выбираем один вариант */
function tryChoice(text, seed) {
  const raw = String(text || "").trim();
  const m = raw.match(/^(.+?)\s+(?:или|or)\s+(.+?)$/i);
  if (!m) return null;
  const a = m[1].replace(/[?!.]+$/g, "").trim();
  const b = m[2].replace(/[?!.]+$/g, "").trim();
  if (!a || !b || a.length > 48 || b.length > 48) return null;
  if (/\s(как|что|how|what)\s/i.test(a)) return null;
  return seed % 2 === 0 ? a : b;
}

export function createPupikBrain(initial = null) {
  const memory = {
    userName: "",
    facts: [],
    lastIntent: "",
    turns: 0,
    mood: 0,
    lang: "ru",
    preferLang: "ru",
    ruStreak: 0,
    enStreak: 0,
    lastFileName: "",
    lastFileKind: "",
    topic: "",
  };

  function hydrate(state) {
    if (!state || typeof state !== "object") return;
    memory.userName = state.userName || "";
    memory.facts = Array.isArray(state.facts) ? state.facts.slice(0, 40) : [];
    memory.lang = state.lang === "en" ? "en" : "ru";
    memory.preferLang = state.preferLang === "en" ? "en" : "ru";
    memory.ruStreak = Number(state.ruStreak) || 0;
    memory.enStreak = Number(state.enStreak) || 0;
    memory.turns = Number(state.turns) || 0;
    memory.mood = Number(state.mood) || 0;
    memory.lastFileName = state.lastFileName || "";
    memory.lastFileKind = state.lastFileKind || "";
    memory.topic = state.topic || "";
    memory.lastIntent = state.lastIntent || "";
  }

  if (initial) hydrate(initial);

  function snapshot() {
    return {
      userName: memory.userName,
      facts: [...memory.facts],
      lang: memory.lang,
      preferLang: memory.preferLang,
      ruStreak: memory.ruStreak,
      enStreak: memory.enStreak,
      turns: memory.turns,
      mood: memory.mood,
      lastFileName: memory.lastFileName,
      lastFileKind: memory.lastFileKind,
      topic: memory.topic,
      lastIntent: memory.lastIntent,
    };
  }

  function noteLang(detected) {
    if (detected === "ru") {
      memory.ruStreak += 1;
      memory.enStreak = 0;
    } else {
      memory.enStreak += 1;
      memory.ruStreak = 0;
    }
    // Долгая беседа на одном языке → предпочитаем его (в т.ч. для раскладки)
    if (memory.ruStreak >= 2) memory.preferLang = "ru";
    if (memory.enStreak >= 3) memory.preferLang = "en";
  }

  function say(key, seed, extra = {}) {
    const lang = memory.lang;
    const friend = lang === "en" ? "friend" : "друг";
    return fillTpl(pickLang(REPLIES[key], lang, seed), {
      nameSuffix: memory.userName ? `, ${memory.userName}` : "",
      userName: memory.userName || friend,
      fact: "",
      facts: memory.facts.map((f, i) => `${i + 1}. ${f}`).join("\n"),
      fileName: memory.lastFileName || (lang === "en" ? "file" : "файл"),
      ...extra,
    });
  }

  function isFollowUp(text) {
    const n = normalize(text);
    return /^(ну\s+)?как\??$|^(ну\s+)?как\s+тебе|получилось|вышло|и\s+что|ну\s+что|and\s+how|did\s+it\s+work|how\s+is\s+it|well\??$|ну\s+как/.test(
      n
    );
  }

  function detectIntent(text) {
    const toks = tokens(text);
    const n = normalize(text);
    let best = { id: "fallback", score: 0 };
    for (const intent of INTENTS) {
      let s = scoreKeywords(toks, intent.keys) * intent.weight;
      for (const k of intent.keys) {
        if (k.includes(" ") && n.includes(k)) s += 2 * intent.weight;
      }
      if (s > best.score) best = { id: intent.id, score: s };
    }
    if (best.score < 1.2) return "fallback";
    return best.id;
  }

  function reply(userText) {
    memory.turns += 1;
    const layout = fixLayout(userText, memory.preferLang);
    const text = layout.fixed ? layout.text : userText;

    const detected = detectLang(text);
    // если поправили раскладку на русский — язык беседы ru
    memory.lang = layout.fixed && letterIsRu(text) ? "ru" : detected;
    noteLang(memory.lang);

    const seed = memory.turns + text.length;
    const sent = sentiment(text);
    const note = layout.fixed ? `${say("layout_note", seed, { fixed: text })}\n` : "";

    if (/хала\s*мадрид|hala\s*madrid/i.test(text)) {
      memory.topic = "football";
      memory.lastIntent = "cheer";
      return { type: "text", text: note + say("cheer", seed) };
    }

    if (isFollowUp(text)) {
      if (memory.lastFileKind === "image" || memory.lastIntent === "file_image") {
        memory.lastIntent = "about_photo";
        return { type: "text", text: note + say("about_photo", seed) };
      }
      if (memory.lastIntent === "image") {
        memory.lastIntent = "about_photo";
        return {
          type: "text",
          text:
            note +
            (memory.lang === "en"
              ? "Yes — the image rendered in the chat above. Want another theme?"
              : "Да — картинка уже в чате выше. Нарисовать ещё одну тему?"),
        };
      }
      memory.lastIntent = "follow_ok";
      return { type: "text", text: note + say("follow_ok", seed) };
    }

    const remembered = extractRemember(text);
    if (remembered) {
      memory.facts = [remembered, ...memory.facts.filter((f) => f !== remembered)].slice(0, 40);
      memory.lastIntent = "remember";
      return { type: "text", text: note + say("remember_ok", seed, { fact: remembered }) };
    }

    const named = extractName(text);
    if (named) {
      memory.userName = named;
      memory.lastIntent = "user_name";
      return { type: "text", text: note + say("user_named", seed) };
    }

    const choice = tryChoice(text, seed);
    if (choice) {
      memory.lastIntent = "choice";
      return { type: "text", text: note + say("choice", seed, { pick: choice }) };
    }

    if (wantsImage(text)) {
      const prompt = extractImagePrompt(text) || text;
      // только вопрос «умеешь?» — без рисования
      if (
        /умеешь|можешь|can you|do you/.test(normalize(text)) &&
        !/нарису|сгенер|generate|draw|создай|сделай\s+меня/.test(normalize(text))
      ) {
        memory.lastIntent = "image_ask";
        return { type: "text", text: note + say("image_ask", seed) };
      }
      const collage = wantsCollage(text);
      memory.lastIntent = "image";
      return {
        type: "image",
        prompt,
        usePhoto: collage,
        text:
          note +
          say(collage ? "image_collage" : "image_cap", seed, { prompt }),
      };
    }

    const solved = trySolve(text);
    if (solved) {
      memory.lang = solved.lang || memory.lang;
      noteLang(memory.lang);
      memory.lastIntent = "task";
      return { type: "text", text: note + solved.answer };
    }

    let intent = detectIntent(text);

    if (intent === "whatever") {
      memory.lastIntent = intent;
      return { type: "text", text: note + say("whatever", seed) };
    }

    if (
      intent === "howareyou" ||
      /настрой|настроен|how are you|как у тебя/.test(normalize(text))
    ) {
      memory.lastIntent = "howareyou";
      return { type: "text", text: note + say("howareyou", seed) };
    }

    if (intent === "mood" || (intent === "fallback" && Math.abs(sent) >= 1)) {
      memory.lastIntent = "mood";
      if (sent > 0) return { type: "text", text: note + say("mood_pos", seed) };
      if (sent < 0) return { type: "text", text: note + say("mood_neg", seed) };
      return { type: "text", text: note + say("mood_neu", seed) };
    }

    if (intent === "recall") {
      memory.lastIntent = intent;
      if (!memory.facts.length && !memory.userName) {
        return { type: "text", text: note + say("recall_empty", seed) };
      }
      const lines = [];
      if (memory.userName) {
        lines.push(memory.lang === "en" ? `Name: ${memory.userName}` : `Имя: ${memory.userName}`);
      }
      lines.push(...memory.facts.map((f, i) => `${i + 1}. ${f}`));
      return { type: "text", text: note + say("recall_full", seed, { facts: lines.join("\n") }) };
    }

    const compact = normalize(text);
    if (compact.length <= 3 || /^(ок|окей|ладно|ну|ага|угу|ok|okay|yeah|yep|mhm)$/.test(compact)) {
      memory.lastIntent = "short_ack";
      return { type: "text", text: note + say("short_ack", seed) };
    }

    memory.lastIntent = intent;
    return { type: "text", text: note + say(REPLIES[intent] ? intent : "fallback", seed) };
  }

  function replyFile(meta) {
    memory.turns += 1;
    const seed = memory.turns;
    memory.lastFileName = meta.name || "";
    memory.lastFileKind = meta.kind || "";
    const size =
      meta.size < 1024
        ? `${meta.size} B`
        : meta.size < 1024 * 1024
          ? `${(meta.size / 1024).toFixed(1)} KB`
          : `${(meta.size / (1024 * 1024)).toFixed(1)} MB`;
    if (meta.kind === "image") {
      memory.lastIntent = "file_image";
      return {
        type: "text",
        text: say("file_image", seed, { name: meta.name, size }),
      };
    }
    if (meta.kind === "text") {
      memory.lastIntent = "file_text";
      const preview = (meta.preview || "").slice(0, 400) || "—";
      return {
        type: "text",
        text: say("file_text", seed, { name: meta.name, size, preview }),
      };
    }
    memory.lastIntent = "file_other";
    return {
      type: "text",
      text: say("file_other", seed, {
        name: meta.name,
        size,
        type: meta.mime || "file",
      }),
    };
  }

  function letterIsRu(s) {
    return (s.match(/[а-яё]/gi) || []).length > (s.match(/[a-z]/gi) || []).length;
  }

  function greeting() {
    return say("greet", Date.now());
  }

  function resetConversation() {
    memory.userName = "";
    memory.facts = [];
    memory.mood = 0;
    memory.turns = 0;
    memory.ruStreak = memory.preferLang === "ru" ? 2 : 0;
    memory.enStreak = memory.preferLang === "en" ? 3 : 0;
    memory.lastIntent = "";
    memory.lastFileName = "";
    memory.lastFileKind = "";
    memory.topic = "";
    return say("cleared_chat", 1);
  }

  return {
    reply,
    replyFile,
    greeting,
    resetConversation,
    hydrate,
    snapshot,
    getLang: () => memory.lang,
    getPreferLang: () => memory.preferLang,
    getMemory: () => ({ ...memory, facts: [...memory.facts] }),
  };
}
