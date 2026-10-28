/**
 * Определение языка и лёгкая локализация ответов.
 */

export function detectLang(text) {
  const s = String(text || "");
  const cyr = (s.match(/[а-яёА-ЯЁ]/g) || []).length;
  const lat = (s.match(/[a-zA-Z]/g) || []).length;
  if (cyr === 0 && lat === 0) return "ru";
  if (cyr >= lat) return "ru";
  return "en";
}

export function pickLang(map, lang, seed = 0) {
  const list = map[lang] || map.ru || map.en;
  if (!list?.length) return "";
  if (typeof list === "string") return list;
  return list[Math.abs(Math.floor(seed)) % list.length];
}

export function fill(template, ctx = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) =>
    ctx[key] != null ? String(ctx[key]) : ""
  );
}
