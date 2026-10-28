/**
 * Исправление текста с «не той» раскладки.
 * «rfr ltka?» / «РФР ЛТКФ?» → «как дела?» если беседа по-русски.
 */

// Без ?! — их оставляем как есть
const EN = "`qwertyuiop[]asdfghjkl;'zxcvbnm,." + '~QWERTYUIOP{}ASDFGHJKL:"ZXCVBNM<>';
const RU = "ёйцукенгшщзхъфывапролджэячсмитьбю" + 'ЁЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ';

const enToRuMap = new Map();
const ruToEnMap = new Map();
for (let i = 0; i < EN.length; i++) {
  enToRuMap.set(EN[i], RU[i]);
  ruToEnMap.set(RU[i], EN[i]);
}

/** Кириллица, которой часто «записывают» латинские буквы (R→Р, F→Ф…) */
const PHON_TO_LAT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function mapChars(text, table) {
  let out = "";
  for (const ch of text) out += table.has(ch) ? table.get(ch) : ch;
  return out;
}

export function enLayoutToRu(text) {
  return mapChars(text, enToRuMap);
}

export function ruLayoutToEn(text) {
  return mapChars(text, ruToEnMap);
}

function phonCyrToLatin(text) {
  let out = "";
  for (const ch of text) {
    const low = ch.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(PHON_TO_LAT, low)) {
      const lat = PHON_TO_LAT[low];
      out += ch === low ? lat : lat.toUpperCase();
    } else {
      out += ch;
    }
  }
  return out;
}

const RU_HINT =
  /(?:^|[\s,.!?])(как|что|это|привет|пока|да|нет|мне|тебя|дела|настрой|хочу|надо|скачать|установить|почему|когда|где|кто|спасибо|пожалуйста|или|хорошо|ладно|ок|сегодня|завтра|хочешь|можешь)(?:[\s,.!?]|$)/i;

const EN_HINT =
  /(?:^|[\s,.!?])(the|and|you|how|what|is|are|hello|thanks|please|download|install|why|when|where|who|yes|no|ok|okay|today|tomorrow)(?:[\s,.!?]|$)/i;

function letterCounts(s) {
  return {
    cyr: (s.match(/[а-яёА-ЯЁ]/g) || []).length,
    lat: (s.match(/[a-zA-Z]/g) || []).length,
  };
}

function scoreRu(s) {
  let score = 0;
  if (RU_HINT.test(s)) score += 5;
  score += (s.match(/[аеёиоуыэюя]/gi) || []).length;
  score += (s.match(/[а-яё]/gi) || []).length * 0.15;
  return score;
}

/**
 * @param {string} text
 * @param {"ru"|"en"} preferLang
 */
export function fixLayout(text, preferLang = "ru") {
  const raw = String(text || "");
  if (!raw.trim()) return { text: raw, fixed: false };

  const { cyr, lat } = letterCounts(raw);

  // Уже нормальный английский — не трогаем, даже если беседа была на ru
  if (lat > 0 && EN_HINT.test(raw) && scoreRu(enLayoutToRu(raw)) < 8) {
    return { text: raw, fixed: false };
  }

  // Уже нормальный русский
  if (cyr > 0 && RU_HINT.test(raw) && lat === 0) {
    // кроме случая фонетической «РФР ЛТКФ» — там тоже кириллица + RU_HINT после фикса
  }

  const candidates = [];

  if (lat >= 2) {
    const fixed = enLayoutToRu(raw);
    if (fixed !== raw) candidates.push(fixed);
  }

  if (cyr >= 2) {
    const viaKeys = enLayoutToRu(ruLayoutToEn(raw));
    if (viaKeys !== raw) candidates.push(viaKeys);

    const phon = phonCyrToLatin(raw);
    if (/[a-z]/i.test(phon)) {
      const fromPhon = enLayoutToRu(phon);
      if (fromPhon !== raw) candidates.push(fromPhon);
    }
  }

  if (preferLang === "en" && cyr > lat) {
    const toEn = ruLayoutToEn(raw);
    if (EN_HINT.test(toEn)) return { text: toEn, fixed: true, from: raw };
  }

  let best = null;
  let bestScore = scoreRu(raw);
  for (const c of candidates) {
    const sc = scoreRu(c);
    // требуем явный русский смысл
    if (!RU_HINT.test(c) && sc < bestScore + 4) continue;
    if (sc > bestScore + 1.2) {
      best = c;
      bestScore = sc;
    }
  }

  if (preferLang === "ru" && best && letterCounts(best).cyr > 0 && RU_HINT.test(best)) {
    // частая опечатка конца: а набрана как a вместо f → «делф»
    best = best.replace(/делф/gi, (m) => (m[0] === "Д" ? "Дела" : "дела"));
    return { text: best, fixed: true, from: raw };
  }

  if (lat >= 3 && cyr === 0) {
    const fixed = enLayoutToRu(raw);
    if (RU_HINT.test(fixed)) return { text: fixed, fixed: true, from: raw };
  }

  // Фонет. кириллица «РФР ЛТКФ» без долгой истории — тоже чиним
  if (cyr >= 3 && lat === 0) {
    const fromPhon = enLayoutToRu(phonCyrToLatin(raw));
    if (RU_HINT.test(fromPhon) && fromPhon !== raw) {
      return { text: fromPhon, fixed: true, from: raw };
    }
  }

  return { text: raw, fixed: false };
}
