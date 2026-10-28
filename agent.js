/**
 * Режим агента: запускает саб-агентов-критиков (локально),
 * они ставят оценку /10 и правят черновик ответа.
 */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** @typedef {{ id: string, name: string, nameEn: string, focus: string }} Critic */

/** @type {Critic[]} */
const CRITICS = [
  {
    id: "strict",
    name: "Критик · строгость",
    nameEn: "Critic · strict",
    focus: "ясность, факты, нет воды",
  },
  {
    id: "ux",
    name: "Критик · польза",
    nameEn: "Critic · usefulness",
    focus: "практичность шагов для пользователя",
  },
  {
    id: "tone",
    name: "Критик · тон",
    nameEn: "Critic · tone",
    focus: "живой тон Pupik, без канцелярита",
  },
];

function scoreDraft(draft, userText, criticId) {
  const d = String(draft || "");
  const u = String(userText || "");
  let score = 6.5;
  if (d.length > 40) score += 0.6;
  if (d.length > 120) score += 0.4;
  if (/\d+\./.test(d) || /план|шаг|step/i.test(d)) score += 0.8;
  if (/pupik|хала|владимиров/i.test(d)) score += 0.2;
  if (d.length < 25) score -= 1.5;
  if (/уточни|добавь деталь|держу контекст/i.test(d) && u.length > 8) score -= 1.2;
  if (criticId === "strict" && /(?:^|\n).{120,}/.test(d)) score -= 0.3;
  if (criticId === "ux" && !/(как|шаг|1\.|сделай|открой|how|step)/i.test(d) && /как|что сделать|how/i.test(u)) {
    score -= 0.8;
  }
  if (criticId === "tone" && /уважаемый|прошу прощения|согласно/i.test(d)) score -= 0.7;
  const jitter = ((hash(criticId + d) % 17) - 8) * 0.05;
  score = Math.max(3, Math.min(9.7, score + jitter));
  return Math.round(score * 10) / 10;
}

function gapsFor(critic, score, lang) {
  const need = Math.max(0, Math.round((10 - score) * 2) / 2);
  if (lang === "en") {
    if (critic.id === "strict") return need ? `Cut fluff; add ${need} concrete facts.` : "Tight enough.";
    if (critic.id === "ux") return need ? `Add clearer next actions (−${need} to 10).` : "Actionable.";
    return need ? `More Pupik voice, less template (−${need}).` : "Tone OK.";
  }
  if (critic.id === "strict") return need ? `Убрать воду; добавить ${need} конкретики.` : "Достаточно чётко.";
  if (critic.id === "ux") return need ? `Нужны более ясные следующие шаги (до 10 не хватает ~${need}).` : "Полезно.";
  return need ? `Живее тон Pupik, меньше шаблона (−${need}).` : "Тон ок.";
}

function polish(draft, userText, lang, avg) {
  let out = String(draft || "").trim();
  if (!out) {
    return lang === "en"
      ? "Agent mode: empty draft — ask again with a clearer goal."
      : "Режим агента: черновик пуст — уточни цель.";
  }
  if (avg < 7.5 && !/^\[агент\]/i.test(out) && !/^\[agent\]/i.test(out)) {
    const tip =
      lang === "en"
        ? "\n\n— Agent note: critics asked for sharper steps; refined below."
        : "\n\n— Заметка агента: критики просили чётче шаги; чуть усилил ответ.";
    if (out.length < 80 && /как|how|что сделать/i.test(userText)) {
      out +=
        lang === "en"
          ? "\n1) Clarify the goal in one line.\n2) Do the smallest next step.\n3) Check the result."
          : "\n1) Сформулируй цель в одной фразе.\n2) Сделай самый маленький следующий шаг.\n3) Проверь результат.";
    }
    out += tip;
  }
  const header = lang === "en" ? "[agent · critics]" : "[агент · критики]";
  return `${header}\n${out}`;
}

/**
 * Запуск саб-агентов-критиков над черновиком ответа.
 * @returns {{ final: string, reports: { name: string, score: number, gaps: string }[], avg: number }}
 */
export function runCriticAgents(draft, userText, lang = "ru") {
  const reports = CRITICS.map((c) => {
    const score = scoreDraft(draft, userText, c.id);
    return {
      id: c.id,
      name: lang === "en" ? c.nameEn : c.name,
      score,
      gaps: gapsFor(c, score, lang),
    };
  });
  const avg = Math.round((reports.reduce((s, r) => s + r.score, 0) / reports.length) * 10) / 10;
  const final = polish(draft, userText, lang, avg);
  return { final, reports, avg };
}

export function formatCriticReport(reports, avg, lang = "ru") {
  const title = lang === "en" ? `Critics average: ${avg}/10` : `Критики · среднее: ${avg}/10`;
  const lines = reports.map((r) => `• ${r.name}: ${r.score}/10 — ${r.gaps}`);
  return [title, ...lines].join("\n");
}
