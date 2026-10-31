
import { generateImage, wantsImage, extractImagePrompt, photoSubjects } from "./generate.js?v=34";
import { trySolve } from "./knowledge.js?v=19";

const MODEL = "onnx-community/Qwen2.5-0.5B-Instruct";
let ai = null;
let loadingPromise = null;

function systemPrompt() {
  return `Ты — Pupik AI на модели Qwen.
Создатель: Владимиров Роберт Павлович.
Пользователя зовут ${userName || "друг"}.
Отвечай на языке пользователя. Если вопрос по-русски, отвечай по-русски.
Объясняй коротко и по делу. Не выдумывай факты. Не ставь оценки вопросам.`;
}

function loadAI() {
  if (ai) return Promise.resolve(ai);
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      const { pipeline, env } = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1");
      env.useBrowserCache = true;
      env.allowLocalModels = false;
      ai = await pipeline("text-generation", MODEL, {
        dtype: "q4",
        device: "wasm",
        progress_callback: () => {}
      });
      return ai;
    } catch (error) {
      ai = null;
      console.warn("Qwen не загрузился:", error);
      return null;
    } finally {
      loadingPromise = null;
    }
  })();
  return loadingPromise;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
  ]);
}

function cleanModelText(text) {
  const clean = String(text || "")
    .replace(/\u0000/g, "")
    .replace(/^[ \t]+/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return clean.length < 8 ? "" : clean;
}

function extractAnswer(result) {
  const generated = result?.[0]?.generated_text;
  if (typeof generated === "string") return generated;
  if (Array.isArray(generated)) {
    const last = [...generated].reverse().find(item => item?.role === "assistant" && typeof item.content === "string");
    return last?.content || "";
  }
  return "";
}

async function qwenAnswer() {
  if (!ai) return "";
  try {
    const prompt = [
      { role: "system", content: systemPrompt() },
      ...chatHistory.slice(-6).map(item => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: String(item.content || "").slice(0, 1500)
      }))
    ];
    const result = await withTimeout(ai(prompt, {
      max_new_tokens: 120,
      temperature: 0.7,
      do_sample: true,
      top_p: 0.9,
      repetition_penalty: 1.08
    }), 8000);
    return cleanModelText(extractAnswer(result));
  } catch (error) {
    console.warn("Qwen не успел:", error);
    return "";
  }
}

const NAME_KEY = "pupik_user_name";

let userName = localStorage.getItem(NAME_KEY) || "";

const sidebar = document.getElementById("sidebar");
const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const messagesElement = document.getElementById("messages");
const welcome = document.getElementById("welcome");
const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const historyElement = document.getElementById("history");
const newChatButton = document.getElementById("newChat");
const menuButton = document.getElementById("menuButton");
const titleElement = document.querySelector(".top-title");

let generating = false;
let chatHistory = [];
let currentChatId = null;
let chats = [];

try {
  const saved = JSON.parse(localStorage.getItem("pupik_chats") || "[]");

  if (Array.isArray(saved)) {
    chats = saved.filter(chat =>
      chat &&
      typeof chat.id === "string" &&
      Array.isArray(chat.messages)
    );
  }
} catch (error) {
  console.warn("Ошибка истории:", error);
}

// Пользователь всегда видит только название агента
function setStatus(online = false) {
  statusText.textContent = online ? "Pupik AI" : "Загружаюсь";
  statusDot.classList.toggle("online", online);
}

function saveChats() {
  try {
    localStorage.setItem("pupik_chats", JSON.stringify(chats));
  } catch (error) {
    console.warn("Ошибка сохранения:", error);
  }
}

function renderHistory() {
  historyElement.innerHTML = "";

  chats.forEach(chat => {
    const row = document.createElement("div");
    row.className = "history-row";

    const button = document.createElement("button");
    button.className = "history-item";
    button.textContent = chat.title || "Новый чат";

    if (chat.id === currentChatId) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => openChat(chat.id));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "history-delete";
    remove.title = "Удалить чат";
    remove.setAttribute("aria-label", "Удалить чат");
    remove.textContent = "×";
    remove.addEventListener("click", () => deleteChat(chat.id));

    row.appendChild(button);
    row.appendChild(remove);
    historyElement.appendChild(row);
  });
}

function clearCurrentChat() {
  if (generating) return;
  if (!currentChatId) {
    createChat();
    return;
  }

  const chat = chats.find(item => item.id === currentChatId);
  chatHistory = [];
  if (chat) {
    chat.messages = [];
    chat.title = "Новый чат";
  }

  saveChats();
  renderHistory();
  renderMessages();
  titleElement.textContent = "Новый диалог";
  input.focus();
}

function deleteChat(id) {
  if (generating) return;

  chats = chats.filter(item => item.id !== id);

  if (!chats.length) {
    currentChatId = null;
    chatHistory = [];
    saveChats();
    createChat();
    return;
  }

  if (currentChatId === id) {
    currentChatId = chats[0].id;
    chatHistory = [...chats[0].messages];
    titleElement.textContent = chats[0].title || "Новый диалог";
    renderMessages();
  }

  saveChats();
  renderHistory();
}

function deleteAllChats() {
  if (generating) return;
  chats = [];
  currentChatId = null;
  chatHistory = [];
  saveChats();
  createChat();
}

function createChat() {
  if (generating) return;

  const chat = {
    id: Date.now().toString(),
    title: "Новый чат",
    messages: []
  };

  chats.unshift(chat);
  currentChatId = chat.id;
  chatHistory = [];

  saveChats();
  renderHistory();
  renderMessages();

  titleElement.textContent = "Новый диалог";
  sidebar.classList.remove("open");
  input.focus();
}

function openChat(id) {
  if (generating) return;

  const chat = chats.find(item => item.id === id);
  if (!chat) return;

  currentChatId = id;
  chatHistory = [...chat.messages];

  titleElement.textContent = chat.title || "Новый диалог";

  renderMessages();
  renderHistory();
  sidebar.classList.remove("open");
}

function renderMessages() {
  messagesElement.innerHTML = "";

  // Начальный экран показывается только в пустом чате
  welcome.style.display = chatHistory.length ? "none" : "flex";

  chatHistory.forEach(message => {
    addMessageToScreen(message.role, message.content, message.image);
  });

  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function addMessageToScreen(role, content, image) {
  const message = document.createElement("div");
  message.className = "message " +
    (role === "user" ? "user-message" : "ai-message");

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user"
    ? (userName || "Я").trim().charAt(0).toUpperCase()
    : "P";

  const body = document.createElement("div");
  body.className = "message-body";

  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = role === "user" ? (userName || "Ты") : "Pupik AI";

  if (content) {
    const text = document.createElement("div");
    text.className = "message-text";
    fillMessage(text, content);
    body.appendChild(text);
  }

  if (image) {
    const picture = document.createElement("img");
    picture.className = "message-image";
    picture.alt = "фото";
    picture.referrerPolicy = "no-referrer";
    picture.src = image;
    body.appendChild(picture);
  }

  body.prepend(name);
  message.appendChild(avatar);
  message.appendChild(body);

  messagesElement.appendChild(message);
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

const EMOJI_KEY = "pupik_emoji";
const LINKS_KEY = "pupik_links";

function flagOn(key, fallback) {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  return value === "1";
}

function agentOn() {
  return false;
}

function emojiOn() {
  return flagOn(EMOJI_KEY, true);
}

function linksOn() {
  return flagOn(LINKS_KEY, true);
}

function fillMessage(element, content) {
  element.replaceChildren();
  const text = String(content || "");
  const pattern = /https?:\/\/[^\s<>"']+/gi;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index || 0;
    if (index > last) element.append(document.createTextNode(text.slice(last, index)));
    const raw = match[0];
    const url = raw.replace(/[),.;!?]+$/, "");
    const link = document.createElement("a");
    link.href = url;
    link.textContent = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    element.append(link);
    if (url.length < raw.length) element.append(document.createTextNode(raw.slice(url.length)));
    last = index + raw.length;
  }
  if (last < text.length) element.append(document.createTextNode(text.slice(last)));
}

function topicLinks(question, answer) {
  const q = question.toLowerCase().replace(/ё/g, "е");
  const links = [];
  const add = (pattern, url) => {
    if (pattern.test(q) && !answer.includes(url) && !links.includes(url)) links.push(url);
  };
  add(/ривалд|rivaldo/, "https://ru.wikipedia.org/wiki/Ривалдо");
  add(/ронал[ьъ]?дин|ronaldinho/, "https://ru.wikipedia.org/wiki/Роналдиньо");
  if (!/ронал[ьъ]?дин|ronaldinho/.test(q)) {
    add(/рона+л*д(?!ин)|криштиан|cristiano/, "https://ru.wikipedia.org/wiki/Криштиану_Роналду");
  }
  add(/месси|messi/, "https://ru.wikipedia.org/wiki/Лионель_Месси");
  add(/рамос|ramos/, "https://ru.wikipedia.org/wiki/Рамос,_Серхио");
  add(/дроб/, "https://ru.wikipedia.org/wiki/Дробь_(математика)");
  add(/нечетн|четн|двух?знач|трехзнач|однознач/, "https://ru.wikipedia.org/wiki/Чётные_и_нечётные_числа");
  add(/бленд|blender/, "https://www.blender.org/");
  add(/питон|python/, "https://www.python.org/");
  add(/визуал|visual code|vscode/, "https://code.visualstudio.com/");
  return links;
}

function replyEmoji(question, hasImage) {
  const q = question.toLowerCase().replace(/ё/g, "е");
  if (hasImage || /фото|нарисуй/.test(q)) return "📸";
  if (/програм|код|питон|python|функци/.test(q)) return "💻";
  if (/объясн|дроб|понят/.test(q)) return "📚";
  if (/кто так|ривалд|ронал|месси|рамос|футбол/.test(q)) return "⚽";
  if (/привет|здравств|как дела/.test(q)) return "👋";
  return "✨";
}

function taskKind(question) {
  const q = question.toLowerCase().replace(/ё/g, "е");
  if (/гном/.test(q)) return "уточнение";
  if (wantsImage(question) || /нарисуй|фото/.test(q)) return "фото";
  if (/програм|код|питон|python|игр/.test(q)) return "код";
  if (/объясн|как понять|дроб/.test(q)) return "объяснение";
  if (/кто так|кто создател|кто такой/.test(q)) return "справка";
  if (/файл|папк|список файлов/.test(q)) return "компьютер";
  return "ответ";
}

function agentLink(question, result) {
  const found = String(result).match(/https?:\/\/[^\s<>"']+/);
  if (found) return found[0].replace(/[),.;]+$/g, "");
  const extra = topicLinks(question, result);
  if (extra.length) return extra[0];
  const q = question.toLowerCase().replace(/ё/g, "е");
  if (/визуал|studio|vscode|игр|код|програм|напиш/.test(q)) return "https://code.visualstudio.com/";
  return "";
}

function asAgent(question, result) {
  if (!agentOn() || !result) return result;
  const files = /index\.html/.test(result) && /game\.js/.test(result);
  const handsOn = /красный кружок|сам нажми|из браузера/.test(result);
  const link = agentLink(question, result);
  const tail = handsOn
    ? (link ? `\n\nВот ссылка: ${link}` : "")
    : (link ? `\n\nГотово. Вот ссылка: ${link}` : "\n\nГотово.");
  const head = files ? "Ок, вот код." : handsOn ? "Ок, вот как." : "Ок.";
  return `${head}\n\n${result}${tail}`;
}

function decorateReply(question, answer, hasImage) {
  if (!answer) return answer;
  let text = answer;
  if (emojiOn() && !/\p{Extended_Pictographic}/u.test(text)) {
    text = `${replyEmoji(question, hasImage)} ${text}`;
  }
  if (linksOn()) {
    const links = topicLinks(question, text);
    if (links.length) text = `${text}\n\n${links.join("\n")}`;
  }
  return text;
}

function addTyping() {
  removeTyping();

  const typing = document.createElement("div");
  typing.className = "typing";
  typing.id = "typing";
  typing.innerHTML = "<span></span><span></span><span></span>";

  messagesElement.appendChild(typing);
}

function removeTyping() {
  document.getElementById("typing")?.remove();
}

function saveCurrentChat() {
  const chat = chats.find(item => item.id === currentChatId);
  if (!chat) return;

  chat.messages = [...chatHistory];

  if (chatHistory.length && chat.title === "Новый чат") {
    chat.title = chatHistory[0].content.slice(0, 32);
  }

  saveChats();
  renderHistory();
  titleElement.textContent = chat.title;
}

const boot = document.getElementById("boot");
const bootStatus = document.getElementById("bootStatus");
const bootBar = document.getElementById("bootBar");
const register = document.getElementById("register");
const registerForm = document.getElementById("registerForm");
const registerTitle = document.getElementById("registerTitle");
const registerSubmit = document.getElementById("registerSubmit");
const cancelName = document.getElementById("cancelName");
const nameInput = document.getElementById("nameInput");
const profileName = document.getElementById("profileName");
const profileIcon = document.getElementById("profileIcon");
const profileButton = document.getElementById("profileButton");

function setBoot(_text, percent) {
  if (bootStatus) bootStatus.textContent = "Загружаюсь";
  if (bootBar && typeof percent === "number") {
    bootBar.style.width = `${Math.max(4, Math.min(100, percent))}%`;
  }
}

function startBootGame() {
  const canvas = document.getElementById("bootGame");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const keys = new Set();
  const player = { x: 150, y: h / 2, r: 14 };
  const keeper = { x: w - 58, y: h / 2, r: 14 };
  const ball = { x: 230, y: h / 2, vx: 0, vy: 0, r: 8 };
  let score = 0;
  let cool = 0;

  function resetBall() {
    ball.x = 230;
    ball.y = h / 2;
    ball.vx = 0;
    ball.vy = 0;
    player.x = 150;
    player.y = h / 2;
  }

  window.addEventListener("keydown", (event) => {
    if (boot?.hidden) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }
    keys.add(event.key.toLowerCase());
  });
  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });

  function down(name) {
    return keys.has(name);
  }

  function frame() {
    if (boot?.hidden) return;
    let mx = 0;
    let my = 0;
    if (down("arrowleft") || down("a")) mx -= 1;
    if (down("arrowright") || down("d")) mx += 1;
    if (down("arrowup") || down("w")) my -= 1;
    if (down("arrowdown") || down("s")) my += 1;
    const len = Math.hypot(mx, my) || 1;
    player.x = Math.min(w - 30, Math.max(24, player.x + (mx / len) * 3.4));
    player.y = Math.min(h - 24, Math.max(24, player.y + (my / len) * 3.4));

    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < player.r + ball.r + 4 && cool <= 0) {
      const kick = dist || 1;
      ball.vx = (dx / kick) * 7.2 + mx * 1.4;
      ball.vy = (dy / kick) * 7.2 + my * 1.4;
      cool = 8;
    }
    if (cool > 0) cool -= 1;

    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= 0.985;
    ball.vy *= 0.985;
    if (ball.y < ball.r || ball.y > h - ball.r) ball.vy *= -1;
    ball.y = Math.min(h - ball.r, Math.max(ball.r, ball.y));
    if (ball.x < ball.r) {
      ball.x = ball.r;
      ball.vx *= -0.6;
    }

    const goalTop = h * 0.32;
    const goalBot = h * 0.68;
    keeper.y += Math.sign(ball.y - keeper.y) * 1.7;
    keeper.y = Math.min(goalBot - 8, Math.max(goalTop + 8, keeper.y));
    const kd = Math.hypot(ball.x - keeper.x, ball.y - keeper.y);
    if (kd < keeper.r + ball.r + 2) {
      ball.vx = -5.5;
      ball.vy = (ball.y - keeper.y) * 0.2;
    }

    if (ball.x > w - 16 && ball.y > goalTop && ball.y < goalBot) {
      score += 1;
      resetBall();
    } else if (ball.x > w - ball.r) {
      ball.x = w - ball.r;
      ball.vx *= -0.7;
    }

    ctx.fillStyle = "#147a3d";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#178a46";
    for (let i = 0; i < 8; i += 1) {
      if (i % 2 === 0) ctx.fillRect((w / 8) * i, 0, w / 8, h);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.beginPath();
    ctx.moveTo(w / 2, 12);
    ctx.lineTo(w / 2, h - 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 48, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(w - 70, goalTop, 58, goalBot - goalTop);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(w - 22, goalTop, 10, goalBot - goalTop);

    ctx.fillStyle = "#f5f7fb";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#2f6bff";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff4d4d";
    ctx.beginPath();
    ctx.arc(keeper.x, keeper.y, keeper.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "700 22px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(score), 22, 40);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function applyName() {
  const name = userName || "Pupik User";
  if (profileName) profileName.textContent = name;
  if (profileIcon) profileIcon.textContent = name.trim().charAt(0).toUpperCase() || "P";
}

function openNameForm() {
  if (!register) return;
  const changing = Boolean(userName);
  if (registerTitle) registerTitle.textContent = changing ? "Новое имя" : "Как тебя зовут?";
  if (registerSubmit) registerSubmit.textContent = changing ? "Сохранить" : "Войти";
  if (cancelName) cancelName.hidden = !changing;
  if (nameInput) nameInput.value = userName || "";
  register.hidden = false;
  nameInput?.focus();
  nameInput?.select();
}

function showApp() {
  if (boot) boot.hidden = true;
  if (register) register.hidden = true;
  applyName();
  setStatus(true);
  input.focus();
}

function afterBoot() {
  loadAI();
  if (!userName) {
    if (boot) boot.hidden = true;
    if (register) {
      register.hidden = false;
      nameInput?.focus();
    }
    return;
  }
  showApp();
}

const NOTES_KEY = "pupik_notes";

function loadNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function remember(note) {
  const notes = loadNotes().filter(item => item !== note);
  notes.unshift(note);
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes.slice(0, 12)));
}

function noteText() {
  const notes = loadNotes();
  return notes.length ? ` Помню: ${notes.join("; ")}.` : "";
}

function named(text) {
  return userName ? `${userName}, ${text}` : text.charAt(0).toUpperCase() + text.slice(1);
}

function previousUserText() {
  const users = chatHistory.filter(item => item.role === "user");
  return (users.length > 1 ? users[users.length - 2].content : "").toLowerCase().replace(/ё/g, "е");
}

function wantsStudioGame(q) {
  return /игр|наивн/.test(q) && /напиш|сделай|создай|визуал|visual|studio|код/.test(q);
}

function studioFiles() {
  return `index.html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Наивная игра</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <main>
    <h1>Угадай число</h1>
    <p id="log">Я загадал число от 1 до 20. Есть 5 попыток.</p>
    <input id="guess" type="number" min="1" max="20">
    <button id="ok" type="button">Проверить</button>
  </main>
  <script src="game.js"></script>
</body>
</html>

game.js
const secret = Math.floor(Math.random() * 20) + 1;
let left = 5;

document.getElementById("ok").onclick = () => {
  const guess = Number(document.getElementById("guess").value);
  const text = document.getElementById("log");
  left -= 1;
  if (guess === secret) text.textContent = "Угадал!";
  else if (!left) text.textContent = "Число было " + secret;
  else text.textContent = (guess < secret ? "Больше. " : "Меньше. ") + "Осталось " + left;
};

style.css
body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #16181d;
  color: #f4f1ea;
  font-family: sans-serif;
}

main { text-align: center; }

input, button {
  font: inherit;
  margin: 6px;
  padding: 8px 12px;
}`;
}

function visualCodeAnswer(q) {
  const visual = /визуал|visual code|scratch|блочн/.test(q);
  const rejectsPython = /не на питон|не питон|без питона|не python/.test(q);
  if (!visual && !rejectsPython) return "";

  const prev = previousUserText();
  const topic = `${q} ${prev}`;
  if (/тренаж|русск|перевод|фраз/.test(topic) && /2|втор/.test(q)) {
    return named(`вот тренажёр слов страницей, без Python. Сохрани как words.html и открой в браузере.

\`\`\`html
<!DOCTYPE html>
<meta charset="utf-8">
<p id="ask"></p>
<input id="word">
<button id="ok">Проверить</button>
<script>
const pairs = [["привет", "hello"], ["спасибо", "thank you"], ["пожалуйста", "please"]];
let i = 0;
const ask = document.getElementById("ask");
function show() { ask.textContent = "Как по-английски: " + pairs[i][0]; }
show();
document.getElementById("ok").onclick = () => {
  const answer = document.getElementById("word").value.trim().toLowerCase();
  ask.textContent = answer === pairs[i][1] ? "Верно" : "Нет, это " + pairs[i][1];
  i = (i + 1) % pairs.length;
  setTimeout(show, 900);
};
</script>
\`\`\`

Файл можно править в Visual Studio Code.`);
  }

  return named(`без Python: это страница, её открывают в браузере и правят в Visual Studio Code. Сохрани как game.html.

\`\`\`html
<!DOCTYPE html>
<meta charset="utf-8">
<p id="log">Я загадал число от 1 до 20. Есть 5 попыток.</p>
<input id="guess" type="number">
<button id="ok">Проверить</button>
<script>
const secret = Math.floor(Math.random() * 20) + 1;
let left = 5;
document.getElementById("ok").onclick = () => {
  const guess = Number(document.getElementById("guess").value);
  const log = document.getElementById("log");
  left -= 1;
  if (guess === secret) log.textContent = "Угадал!";
  else if (!left) log.textContent = "Число было " + secret;
  else log.textContent = (guess < secret ? "Больше. " : "Меньше. ") + "Осталось " + left;
};
</script>
\`\`\`

Идея 2 — тренажёр слов, идея 3 — табло. Напиши номер.`);
}

function codeAnswer(q) {
  const game = /игр/.test(q) && /питон|python|наивн|програм|напиш|код/.test(q);
  if (game) {
    return named(`вот наивная игра на Python — угадай число от 1 до 20.

\`\`\`python
import random

secret = random.randint(1, 20)
print("Я загадал число от 1 до 20. Есть 5 попыток.")

for attempt in range(1, 6):
    guess = int(input(f"Попытка {attempt}: "))
    if guess == secret:
        print("Угадал!")
        break
    print("Больше." if guess < secret else "Меньше.")
else:
    print("Число было", secret)
\`\`\`

Сохрани как game.py и запусти: python3 game.py
Нужна другая игра — напиши какая.`);
  }

  const program = /програм|код|скрипт|питон|python|функци/.test(q) && /напиш|помог|сделай|создай|програм/.test(q);
  if (program) {
    return named(`начнём с маленькой программы. Напиши, что она должна делать. Пока каркас на Python:

\`\`\`python
def main():
    name = input("Как тебя зовут? ")
    print(f"Привет, {name}. Программа работает.")

if __name__ == "__main__":
    main()
\`\`\`

Запуск: python3 main.py`);
  }

  return "";
}

function explainAnswer(q) {
  if (/дроб/.test(q) && /дел|понят|объясн/.test(q)) {
    return named(`деление дробей — это вопрос «сколько раз вторая дробь помещается в первой». Делить на дробь значит умножить на неё наоборот: верх и низ меняются местами.

1/2 ÷ 1/4 = 1/2 × 4/1 = 2.
В одной половине помещаются две четверти, поэтому ответ 2.

Ещё пример, 3/4 ÷ 2/5:
1. Вторую дробь переверни: 2/5 становится 5/2.
2. Умножь верхи и низы: 3×5 и 4×2, получается 15/8.
3. 15/8 — это одна целая и 7/8.

Напиши две свои дроби — посчитаю так же по шагам.`);
  }
  if (!/объясн|как понять/.test(q)) return "";
  if (/функци|python|питон/.test(q)) {
    return named(`возьмём функцию. Это кнопка с именем: даёшь ей данные, она делает одно дело и отдаёт результат.

\`\`\`python
def удвоить(число):
    return число * 2

print(удвоить(7))  # 14
\`\`\`

Напиши, какую тему разобрать дальше: Python, русский или футбол.`);
  }
  if (/сложн/.test(q)) {
    return named("напиши тему своими словами. Например: деление дробей или сколько нечётных двухзначных чисел.");
  }
  return "";
}

function digitsRepeat(n) {
  const text = String(n);
  return new Set(text).size !== text.length;
}

function countAnswer(q) {
  if (!/сколько|разбер|посчитай|существу/.test(q)) return "";
  const spans = [
    [/четыр[её]хзнач/, 1000, 9999, "четырёхзначные"],
    [/тр[её]хзнач/, 100, 999, "трёхзначные"],
    [/двух?знач/, 10, 99, "двухзначные"],
    [/однознач/, 0, 9, "однозначные"]
  ];
  const span = spans.find(([pattern]) => pattern.test(q));
  if (!span || !/чисел|числа|цифр|знач/.test(q)) return "";
  const [, from, to, label] = span;
  const odd = /неч[её]т/.test(q);
  const even = !odd && /ч[её]тн/.test(q);
  const distinct = /неповторя|разн[а-я]* цифр|без повтор/.test(q);
  const multiple = Number((q.match(/кратн[а-яё]*\s+(\d+)|на\s+(\d+)/) || []).slice(1).find(Boolean)) || 0;
  let total = 0;
  const examples = [];
  const skipped = [];
  for (let n = from; n <= to; n += 1) {
    if (odd && n % 2 === 0) continue;
    if (even && n % 2 !== 0) continue;
    if (multiple && n % multiple !== 0) continue;
    if (distinct && digitsRepeat(n)) {
      if (skipped.length < 5) skipped.push(n);
      continue;
    }
    total += 1;
    if (examples.length < 5) examples.push(n);
  }
  const filters = [
    odd ? "нечётные" : "",
    even ? "чётные" : "",
    distinct ? "без повторяющихся цифр" : "",
    multiple ? `кратные ${multiple}` : ""
  ].filter(Boolean);
  const among = filters.length ? `Нужны ${filters.join(", ")}. ` : "";
  const last = odd
    ? "Последняя цифра 1, 3, 5, 7 или 9."
    : even
      ? "Последняя цифра 0, 2, 4, 6 или 8."
      : "Считаю все числа в этом промежутке.";
  const skipLine = skipped.length ? `\n${skipped.join(", ")} не считаю: цифры повторяются.` : "";
  return named(`${label} числа идут от ${from} до ${to}. ${among}${last}

Примеры: ${examples.join(", ")}.
Таких чисел ${total}.${skipLine}`);
}

function countRules(q) {
  const spans = [
    [/четыр[её]хзнач/, 1000, 9999, "четырёхзначное"],
    [/тр[её]хзнач/, 100, 999, "трёхзначное"],
    [/двух?знач/, 10, 99, "двухзначное"],
    [/однознач/, 0, 9, "однозначное"]
  ];
  const span = spans.find(([pattern]) => pattern.test(q));
  const odd = /неч[её]т/.test(q);
  return {
    from: span ? span[1] : null,
    to: span ? span[2] : null,
    label: span ? span[3] : "",
    odd,
    even: !odd && /ч[её]тн/.test(q),
    distinct: /неповторя|разн[а-я]* цифр|без повтор/.test(q)
  };
}

function whyCount(q) {
  if (!/почему|зачем|отчего/.test(q)) return "";
  const raw = (q.match(/\d+/) || [])[0];
  if (!raw) return "";
  const sample = Number(raw);
  const earlier = recentUserTexts(6).find(item => /сколько|существу|двух?знач|трехзнач|однознач|неч[её]т|четн/.test(item)) || "";
  if (!earlier) return "";
  const rules = countRules(earlier);
  const reasons = [];
  if (rules.from != null && (sample < rules.from || sample > rules.to)) {
    reasons.push(`оно не ${rules.label}: такие числа от ${rules.from} до ${rules.to}`);
  }
  if (rules.odd && sample % 2 === 0) {
    reasons.push(`оно чётное, последняя цифра ${raw.slice(-1)}, а нужны нечётные`);
  }
  if (rules.even && sample % 2 !== 0) {
    reasons.push("оно нечётное, а нужны чётные");
  }
  if (rules.distinct && digitsRepeat(sample)) {
    reasons.push("цифры в нём повторяются");
  }
  if (!reasons.length) return named(`${sample} как раз считается: оно подходит под условие.`);
  return named(`${sample} не считается: ${reasons.join(", и ")}.`);
}

function countFollowUp(q) {
  const why = whyCount(q);
  if (why) return why;
  if (!/не должн|не счита|убери|подобн|таму|тому/.test(q)) return "";
  const earlier = recentUserTexts(6).find(item => /сколько|существу|двух?знач|трехзнач|однознач/.test(item));
  if (!earlier) return "";
  const sample = (q.match(/\d+/) || [])[0] || "";
  const repeats = sample.length > 1 && new Set(sample).size < sample.length;
  const next = repeats || /неповторя/.test(q) ? `${earlier} неповторяющихся` : earlier;
  return countAnswer(next);
}

function ideaAnswer(q) {
  if (!/иде|проект/.test(q)) return "";
  return named(`три идеи на один вечер:

1. Игра «угадай число»: программа загадывает число, ты угадываешь.
2. Тренажёр русских фраз: показывает слово, ты пишешь перевод.
3. Мини-табло: вводишь счёт, программа говорит, кто победил.

Напиши номер и как кодить: питон или визуальный код (страница для браузера).`);
}

function factAnswer(q) {
  if (!/факт|интересн|расскажи|поболта/.test(q)) return "";
  const lines = [
    "Криштиану Роналду родился 5 февраля 1985 года. Номер 7 он носил в «Манчестер Юнайтед», «Реале» и сборной.",
    "Python назвали не в честь змеи, а в честь шоу Monty Python.",
    "В русском ударение часто меняет смысл: замок и замок, мука и мука."
  ];
  if (loadNotes().some(note => /русск/.test(note))) {
    lines.push("Фраза для тренировки: «Я учусь говорить по-русски».");
  }
  return named("держи.\n\n" + lines.map((line, i) => `${i + 1}. ${line}`).join("\n"));
}

function localAnswer(question) {
  const q = question.toLowerCase().replace(/ё/g, "е");
  const name = userName || "";

  if (/учу русск|изучаю русск|учу язык/.test(q)) {
    remember("учит русский");
  }
  if (/люблю футбол|играю в футбол/.test(q)) {
    remember("любит футбол");
  }

  if (/кто создател|кто создал|кто автор|who created|who made/.test(q)) {
    return "Создатель: Владимиров Роберт Павлович.";
  }
  const who = whoAnswer(q);
  if (who) return who;
  if (/гном/.test(q)) {
    return "Ты имел в виду Месси?";
  }
  if (/^(привет|здравств|хай|hello|hi)(\s|$)/.test(q)) {
    return `${name ? `Привет, ${name}` : "Привет"}. Я твой помощник: могу написать программу, рассказать факт, поучить русскому и нарисовать.${noteText()}`;
  }
  if (/как дела|как ты/.test(q)) {
    return `${name ? name + ", у" : "У"} меня всё в порядке. Чем помочь?${noteText()}`;
  }
  if (/учу русск|изучаю русск|русский язык|по-русски/.test(q)) {
    return `${name ? name + ", д" : "Д"}ержу это в голове. Фраза на сегодня: «Я учусь говорить по-русски». Слова: привет, спасибо, пожалуйста. Повтори их вслух, потом напиши своё предложение — поправлю.`;
  }
  if (/что умеешь|личный помощник|кто ты/.test(q)) {
    return `Я Pupik AI${name ? ", помощник " + name : ""}. Пишу код, разбираю задачу по шагам, учу русский и показываю фото.${noteText()}`;
  }
  const closing = windowAnswer(q);
  if (closing) return closing;

  const task = bareTask(q);
  if (task) return task;

  if (/сколько/.test(q) && /кот/.test(q) && /пл[ао]нет|мир|земл/.test(q)) {
    return `${name ? name + ", т" : "Т"}очного числа нет: кошек никто не переписывает всех сразу. Домашних оценивают примерно в 600 миллионов, а вместе с бездомными — около миллиарда.`;
  }

  if (agentOn() && wantsStudioGame(q)) return studioFiles();

  const visual = visualCodeAnswer(q);
  if (visual) return visual;

  const code = codeAnswer(q);
  if (code) return code;

  const counted = countAnswer(q) || countFollowUp(q);
  if (counted) return counted;

  const explained = explainAnswer(q);
  if (explained) return explained;

  const idea = ideaAnswer(q);
  if (idea) return idea;

  const facts = factAnswer(q);
  if (facts) return facts;

  const aboutPhoto = photoReaction(q);
  if (aboutPhoto) return aboutPhoto;

  const download = downloadAnswer(q);
  if (download) return download;

  const solved = trySolve(question);
  if (solved?.answer && !/нарисуй/.test(q)) return solved.answer;

  return "";
}

function whoAnswer(q) {
  if (!/кто так|who is|who was/.test(q)) return "";
  const people = [
    [/ривалд|rivaldo/, "Ривалдо — бразильский футболист, Ривалдо Витор Борба Феррейра. Родился 19 апреля 1972 года. Атакующий полузащитник, левая нога. В 1999 году получил «Золотой мяч». Со сборной выиграл чемпионат мира 2002 года. Главные годы — «Барселона», 1997–2002."],
    [/ронал[ьъ]?дин|ronaldinho/, "Роналдиньо — бразильский футболист Роналдо де Ассис Морейра. Родился 21 марта 1980 года. Чемпион мира 2002 года и обладатель «Золотого мяча» 2005 года. Звезда «Барселоны», его узнают по финтам."],
    [/рона+л*д(?!ин)|криштиан|cristiano/, "Криштиану Роналду — португальский нападающий. Родился 5 февраля 1985 года. Играл за «Манчестер Юнайтед», «Реал», «Ювентус» и сборную Португалии. Пять «Золотых мячей», игровой номер 7."],
    [/месси|messi/, "Лионель Месси — аргентинский нападающий. Родился 24 июня 1987 года. Долго играл в «Барселоне», потом в «ПСЖ» и «Интер Майами». Чемпион мира 2022 года."],
    [/рамос|ramos/, "Серхио Рамос — испанский защитник. Родился 30 марта 1986 года. Капитан «Реала» и сборной Испании, чемпион мира 2010 года."]
  ];
  const hit = people.find(([pattern]) => pattern.test(q));
  return hit ? named(hit[1]) : "";
}

const CS_LINK = "https://store.steampowered.com/app/730/CounterStrike_2/";

function isCs(q) {
  return /(?:^|[^а-я])кс2?(?:[^а-я]|$)|cs2|counter-?strike|контр/.test(q);
}

function downloadAnswer(q) {
  if (!isCs(q)) return "";
  const mac = /мак\s*бук|macbook|на мак|для мак/.test(q);
  if (mac) {
    return named(`Counter-Strike 2 бесплатный в Steam, но версии для Mac нет: только Windows и Linux. На макбуке официального установщика нет. Страница игры: ${CS_LINK}`);
  }
  return named(`Counter-Strike 2 бесплатный в Steam: ${CS_LINK}`);
}

function recentUserTexts(limit = 4) {
  const users = chatHistory.filter(item => item.role === "user");
  return users.slice(0, -1).slice(-limit).map(item => item.content.toLowerCase().replace(/ё/g, "е"));
}

function linkTarget(q) {
  return q
    .replace(/(?:^|[^а-яa-z])(?:дай|скинь|пришли|нужн[а-я]*|найди|покажи|официальн[а-я]*|сайт[а-я]*|ссылк[а-я]*|на|мне|пожалуйста)(?=[^а-яa-z]|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function wikiJson(base, params) {
  const url = new URL(base);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url);
  if (!response.ok) throw new Error("wiki");
  return response.json();
}

async function officialSite(name) {
  const opened = await wikiJson("https://ru.wikipedia.org/w/api.php", {
    action: "opensearch",
    search: name,
    limit: "1",
    namespace: "0",
    format: "json",
    origin: "*"
  });
  const title = opened?.[1]?.[0] || name;
  let found = await wikiJson("https://www.wikidata.org/w/api.php", {
    action: "wbsearchentities",
    search: title,
    language: "ru",
    format: "json",
    origin: "*",
    limit: "1"
  });
  let hit = found.search?.[0];
  if (!hit) {
    found = await wikiJson("https://www.wikidata.org/w/api.php", {
      action: "wbsearchentities",
      search: title,
      language: "en",
      format: "json",
      origin: "*",
      limit: "1"
    });
    hit = found.search?.[0];
  }
  if (!hit?.id) return null;
  const entity = await wikiJson("https://www.wikidata.org/w/api.php", {
    action: "wbgetentities",
    ids: hit.id,
    props: "claims",
    format: "json",
    origin: "*"
  });
  const claims = entity.entities?.[hit.id]?.claims?.P856;
  const url = claims?.[0]?.mainsnak?.datavalue?.value;
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return { name: hit.label || title, url: url.replace(/^http:\/\//i, "https://") };
}

async function answerOfficialLink(question) {
  const q = question.toLowerCase().replace(/ё/g, "е");
  if (!/ссылк|официальн[а-я]*\s+сайт/.test(q)) return "";
  const target = linkTarget(q);
  const source = target || recentUserTexts(4).map(linkTarget).find(Boolean) || "";
  if (!source) return named("напиши, на что нужна ссылка.");
  if (isCs(source) || isCs(q)) return downloadAnswer(`${source} ${q}`);
  try {
    const site = await officialSite(source);
    if (site) return named(`вот ссылка на ${site.name}: ${site.url}`);
  } catch (error) {
    console.warn("Сайт не найден:", error);
  }
  return named(`не нашёл официальный сайт «${source}».`);
}

let projectDirectory = null;

function safeFileName(raw) {
  const name = String(raw || "").trim().replace(/[?!.]+$/g, "");
  if (!name || /[\\/]|\.\./.test(name)) return "";
  if (!/^[\p{L}\p{N} .()-]+\.(txt|md|py|js|html|css|json)$/iu.test(name)) return "";
  return name;
}

function computerTask(question) {
  const q = question.toLowerCase().replace(/ё/g, "е");
  if (/запусти программ|открой калькулятор|выключи компьютер|удали систем/.test(q)) return { type: "unsupported" };
  if (/список файлов|покажи файлы|какие файлы|файлы в папке/.test(q)) return { type: "list" };
  const read = question.match(/(?:прочитай|открой|покажи)\s+файл\s+(.+)$/i);
  if (read) {
    const name = safeFileName(read[1]);
    return name ? { type: "read", name } : { type: "badname" };
  }
  const write = question.match(/(?:создай|запиши|сохрани)\s+файл\s+(\S+)(?:\s+с текстом\s+([\s\S]+))?$/i);
  if (write) {
    const name = safeFileName(write[1]);
    const body = `${(write[2] || "Файл создан Pupik AI.").trim()}\n`;
    return name ? { type: "write", name, body } : { type: "badname" };
  }
  return null;
}

function computerReply(task) {
  if (task.type === "unsupported") {
    return named("в браузере я не запускаю программы и не трогаю систему. С разрешения могу показать, прочитать или записать файл в папке, которую ты выберешь.");
  }
  if (task.type === "badname") {
    return named("имя файла должно быть без папок, с расширением txt, md, py, js, html, css или json.");
  }
  const what = task.type === "list"
    ? "показать имена файлов в выбранной папке"
    : task.type === "read"
      ? `прочитать файл ${task.name}`
      : `записать файл ${task.name}`;
  return named(`нужно разрешение: ${what}. Нажми «Разрешить» и выбери папку. Другие места на компьютере я не открою.`);
}

function showPermission(task) {
  if (!task || task.type === "unsupported" || task.type === "badname") return;
  const card = document.createElement("section");
  card.className = "agent-card";
  const heading = document.createElement("strong");
  heading.textContent = "Агент просит разрешение";
  const details = document.createElement("p");
  details.textContent = task.type === "list"
    ? "Прочитаю только имена файлов в папке, которую ты укажешь."
    : task.type === "read"
      ? `Прочитаю файл ${task.name} из выбранной папки.`
      : `Запишу файл ${task.name} в выбранную папку. Старый файл с таким именем будет заменён.`;
  const actions = document.createElement("div");
  actions.className = "agent-actions";
  const approve = document.createElement("button");
  approve.type = "button";
  approve.className = "agent-approve";
  approve.textContent = "Разрешить";
  const reject = document.createElement("button");
  reject.type = "button";
  reject.className = "agent-reject";
  reject.textContent = "Отклонить";
  approve.addEventListener("click", async () => {
    approve.disabled = true;
    reject.disabled = true;
    try {
      if (!projectDirectory) {
        if (!window.showDirectoryPicker) {
          throw new Error("Этот браузер не даёт выбрать папку. Открой Pupik AI в Chrome.");
        }
        projectDirectory = await window.showDirectoryPicker({ mode: "readwrite" });
      }
      let text = "";
      if (task.type === "list") {
        const names = [];
        for await (const [name, handle] of projectDirectory.entries()) {
          names.push(`${handle.kind === "directory" ? "папка" : "файл"} ${name}`);
        }
        text = names.length ? names.join("\n") : "Папка пустая.";
      } else if (task.type === "read") {
        const handle = await projectDirectory.getFileHandle(task.name);
        text = await (await handle.getFile()).text();
      } else {
        const handle = await projectDirectory.getFileHandle(task.name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(task.body);
        await writable.close();
        text = `Записал ${task.name} в папку ${projectDirectory.name}.`;
      }
      card.remove();
      const done = `Готово, папка «${projectDirectory.name}».\n${text.slice(0, 4000)}`;
      chatHistory.push({ role: "assistant", content: done });
      addMessageToScreen("assistant", done);
      saveCurrentChat();
    } catch (error) {
      approve.disabled = false;
      reject.disabled = false;
      if (error?.name === "AbortError") return;
      details.textContent = error?.message || "Не удалось выполнить действие.";
    }
  });
  reject.addEventListener("click", () => {
    card.remove();
    const done = "Действие отклонено. Файлы не открывал.";
    chatHistory.push({ role: "assistant", content: done });
    addMessageToScreen("assistant", done);
    saveCurrentChat();
  });
  actions.append(approve, reject);
  card.append(heading, details, actions);
  messagesElement.appendChild(card);
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function bareTask(q) {
  if (!/разбер|реши/.test(q) || !/задач|номер|пример/.test(q)) return "";
  const rest = q
    .replace(/разбер[а-я]*|задач[а-я]*|номер[а-я]*|пример[а-я]*|реши|помоги|пожалуйста|мне/g, " ")
    .replace(/\d+/g, " ")
    .replace(/[^а-яa-z]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (rest.length > 2) return "";
  const num = (q.match(/\d+/) || [])[0];
  return named(num
    ? `в сообщении только номер ${num}, условия нет. Пришли текст задачи целиком.`
    : "пришли текст задачи целиком: в сообщении нет условия.");
}

function windowAnswer(q) {
  if (!/закр|quit/.test(q) || !/бленд|blender|окно|программ|приложен/.test(q)) return "";
  const blender = /бленд|blender/.test(q);
  const name = blender ? "Blender" : "программы";
  const menu = blender ? "В Blender: File → Quit, либо Cmd+Q." : "В меню программы: Quit, либо Cmd+Q.";
  return named(`из браузера красный кружок не нажимается. На Mac закрой ${name} так:

1. Красный кружок слева сверху в окне ${name}.
2. ${menu}
3. Save — оставить файл. Don't Save — закрыть без сохранения.`);
}

function fallbackAnswer() {
  const name = userName || "";
  return `${name ? name + ", я" : "Я"} на связи. Могу написать программу, разобрать задачу, рассказать факт или нарисовать.`;
}

function drawingCaption(question) {
  const q = question.toLowerCase().replace(/ё/g, "е");
  if (/учу русск|изучаю русск/.test(q)) remember("учит русский");
  const labels = photoSubjects(question).map(item => item.label);
  const again = /друг|ещ[её]|another|different/.test(q);
  if (labels.length > 1 && /сбив|толк|подкат/.test(q)) {
    return `Вот фото: ${labels[0]} сбивает ${labels[1]}.`;
  }
  if (labels.length > 1) return `${again ? "Вот другие фото" : "Вот фото"}: ${labels.join(" и ")}.`;
  if (labels.length === 1 && /забив|забил|(?:^|[^а-я])гол(?:а|у|ом|е|ы|ов)?(?:[^а-я]|$)/.test(q)) {
    return `Вот фото: ${labels[0]} забивает гол.`;
  }
  if (labels.length === 1) return again ? `Вот другое фото: ${labels[0]}.` : `Вот фото: ${labels[0]}.`;
  return "Вот фото.";
}

function previousImagePrompt() {
  const users = chatHistory.filter(item => item.role === "user");
  for (let i = users.length - 2; i >= 0; i -= 1) {
    if (wantsImage(users[i].content)) return users[i].content;
  }
  return "";
}

function photoReaction(q) {
  if (!/плач/.test(q)) return "";
  const prompt = previousImagePrompt();
  const label = prompt ? photoSubjects(prompt)[0]?.label : "";
  if (!label) return "";
  return named(`на этом фото ${label} не плачет: он улыбается.`);
}

function imageFollowUp(question) {
  const q = question.toLowerCase().replace(/ё/g, "е");
  const pose = /лицом|спереди|анфас|в лицо|со спины|сзади/.test(q);
  if (wantsImage(question)) return "";
  if (!pose && !/(?:^|[^а-я])где(?:[^а-я]|$)|(?:^|[^а-я])нет(?:[^а-я]|$)|не вижу|потеря/.test(q)) return "";
  if (!pose && !photoSubjects(q).some(item => item.known)) return "";
  const last = [...chatHistory].reverse().find(item => item.role === "user" && wantsImage(item.content));
  if (!last) return pose ? "" : question;
  return `${last.content} ${question}`;
}

async function sendMessage(text) {
  const question = text.trim();

  if (!question || generating) return;

  if (!currentChatId) {
    const chat = {
      id: Date.now().toString(),
      title: "Новый чат",
      messages: []
    };

    chats.unshift(chat);
    currentChatId = chat.id;
    chatHistory = [];
  }

  generating = true;
  sendButton.disabled = true;
  input.disabled = true;

  welcome.style.display = "none";

  chatHistory.push({
    role: "user",
    content: question
  });

  addMessageToScreen("user", question);
  saveCurrentChat();
  addTyping();

  try {
    let answer = "";
    let image = "";

    const follow = imageFollowUp(question);
    const job = computerTask(question);
    const official = (!job && !(wantsImage(question) || follow)) ? await answerOfficialLink(question) : "";
    if (official) {
      answer = official;
    } else if (job) {
      answer = computerReply(job);
    } else if (/гном/.test(question.toLowerCase().replace(/ё/g, "е"))) {
      answer = "Ты имел в виду Месси?";
    } else if (wantsImage(question) || follow) {
      const prompt = follow || extractImagePrompt(question);
      try {
        const drawn = await generateImage(prompt);
        image = drawn.dataUrl;
        const caption = drawingCaption(prompt);
        const pose = /лицом|спереди|анфас|в лицо/.test(question.toLowerCase());
        if (pose) {
          answer = caption.replace(/\.$/, " лицом вперёд.");
        } else if (follow) {
          const missing = photoSubjects(question)[0]?.label || "это";
          const titled = missing.charAt(0).toUpperCase() + missing.slice(1);
          answer = `${titled} тоже на фото. ${caption}`;
        } else {
          answer = caption;
        }
      } catch (error) {
        console.warn("Фото не найдено:", error);
        answer = error?.message && error.message !== "no photo"
          ? error.message
          : "Не нашёл фото по этим словам.";
      }
    } else {
      answer = localAnswer(question);
    }

    if (!answer && !image) answer = await qwenAnswer();
    if (!answer && !image) answer = fallbackAnswer();
    answer = decorateReply(question, asAgent(question, answer), Boolean(image));

    removeTyping();

    chatHistory.push({
      role: "assistant",
      content: answer,
      image
    });

    addMessageToScreen("assistant", answer, image);
    if (job) showPermission(job);
    saveCurrentChat();

  } catch (error) {
    removeTyping();
    console.error("Ошибка Pupik AI:", error);

    const errorMessage = decorateReply(question, asAgent(question, localAnswer(question) || fallbackAnswer()), false);
    chatHistory.push({
      role: "assistant",
      content: errorMessage
    });
    addMessageToScreen("assistant", errorMessage);
    saveCurrentChat();
  } finally {
    generating = false;
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const text = input.value.trim();
  if (!text || generating) return;

  input.value = "";
  input.style.height = "auto";

  sendMessage(text);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

newChatButton.addEventListener("click", createChat);
document.getElementById("clearChat").addEventListener("click", clearCurrentChat);
document.getElementById("deleteChats").addEventListener("click", deleteAllChats);

menuButton.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => {
    const prompt = button.dataset.prompt;
    if (prompt) sendMessage(prompt);
  });
});

// При открытии сайта показываем начальный экран,
// а историю — в боковой панели.
renderHistory();

if (chats.length > 0) {
  currentChatId = null;
  chatHistory = [];
  renderMessages();
  titleElement.textContent = "Новый диалог";
} else {
  renderMessages();
}

setStatus(false);
applyName();

const emojiMode = document.getElementById("emojiMode");
const linksMode = document.getElementById("linksMode");
const agentHint = document.getElementById("agentHint");

function syncTool(button, on) {
  button?.classList.toggle("active", on);
  button?.setAttribute("aria-pressed", on ? "true" : "false");
}

function syncAgent() {
  syncTool(emojiMode, emojiOn());
  syncTool(linksMode, linksOn());
  const notes = [];
  if (emojiOn()) notes.push("смайлики");
  if (linksOn()) notes.push("ссылки");
  if (agentHint) agentHint.textContent = notes.length ? notes.join(" · ") : "Обычный диалог";
  if (input) input.placeholder = "Напиши сообщение Pupik AI...";
}

function toggleFlag(key, read) {
  localStorage.setItem(key, read() ? "0" : "1");
  syncAgent();
}

emojiMode?.addEventListener("click", () => toggleFlag(EMOJI_KEY, emojiOn));
linksMode?.addEventListener("click", () => toggleFlag(LINKS_KEY, linksOn));

syncAgent();

registerForm?.addEventListener("submit", event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  userName = name;
  localStorage.setItem(NAME_KEY, name);
  renderMessages();
  showApp();
});

profileButton?.addEventListener("click", openNameForm);

cancelName?.addEventListener("click", () => {
  if (register) register.hidden = true;
});

startBootGame();
let bootPercent = 8;
const bootTimer = setInterval(() => {
  bootPercent = Math.min(100, bootPercent + 18);
  setBoot("Загружаюсь", bootPercent);
  if (bootPercent >= 100) clearInterval(bootTimer);
}, 200);
setTimeout(afterBoot, 1200);

console.log("Pupik AI запущен.");
