
import { pipeline, env } from
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
import { generateImage, wantsImage, extractImagePrompt } from "./generate.js";
import { trySolve } from "./knowledge.js";

env.useBrowserCache = true;

const MODEL = "onnx-community/Qwen2.5-0.5B-Instruct";

const NAME_KEY = "pupik_user_name";

let userName = localStorage.getItem(NAME_KEY) || "";

function systemPrompt() {
  return `
Ты — Pupik AI на модели Qwen.
Создатель: Владимиров Роберт Павлович.
Пользователя зовут ${userName || "друг"}.
- Отвечай на вопросы пользователя.
- Объясняй сложные темы простыми словами.
- Помогай с программированием, математикой и идеями.
- Общайся дружелюбно и естественно.
- Не оценивай вопросы пользователя.
- Не ставь баллы и рейтинги.
- Не проверяй качество вопросов.
- Не выдумывай факты.
- Если пользователь пишет по-русски, отвечай по-русски.
- Давай понятные и полезные ответы.
`;
}

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

let ai = null;
let loadingPromise = null;
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
    const button = document.createElement("button");
    button.className = "history-item";
    button.textContent = chat.title || "Новый чат";

    if (chat.id === currentChatId) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => openChat(chat.id));
    historyElement.appendChild(button);
  });
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
    text.textContent = content;
    body.appendChild(text);
  }

  if (image) {
    const picture = document.createElement("img");
    picture.className = "message-image";
    picture.alt = content || "рисунок";
    picture.src = image;
    body.appendChild(picture);
  }

  body.prepend(name);
  message.appendChild(avatar);
  message.appendChild(body);

  messagesElement.appendChild(message);
  messagesElement.scrollTop = messagesElement.scrollHeight;
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
const nameInput = document.getElementById("nameInput");
const profileName = document.getElementById("profileName");
const profileIcon = document.getElementById("profileIcon");

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

function showApp() {
  if (boot) boot.hidden = true;
  if (register) register.hidden = true;
  applyName();
  input.focus();
}

function afterBoot() {
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

async function loadAI() {
  if (ai) return ai;
  if (loadingPromise) return loadingPromise;

  setBoot("Загружаюсь", 6);

  loadingPromise = (async () => {
    try {
      console.log("Pupik AI: подготовка модели", MODEL);

      ai = await pipeline("text-generation", MODEL, {
        dtype: "q4",
        device: "wasm",
        progress_callback: info => {
          console.log("Pupik progress:", info);
          if (info.status === "progress" && typeof info.progress === "number") {
            setBoot("Загружаюсь", info.progress);
          } else if (info.status === "initiate" || info.status === "download") {
            setBoot("Загружаюсь", 8);
          }
        }
      });

      setStatus(true);
      setBoot("Загружаюсь", 100);
      console.log("Pupik AI готов!");

      return ai;

    } catch (error) {
      ai = null;
      console.error("Ошибка модели:", error);
      setBoot("Загружаюсь", 100);
      throw error;

    } finally {
      loadingPromise = null;
      afterBoot();
    }
  })();

  return loadingPromise;
}

function extractAnswer(result) {
  const generated = result?.[0]?.generated_text;

  if (typeof generated === "string") {
    return generated;
  }

  if (Array.isArray(generated)) {
    const last = [...generated].reverse().find(item =>
      item?.role === "assistant" &&
      typeof item.content === "string"
    );

    return last?.content || "";
  }

  return "";
}

function localAnswer(question) {
  const q = question.toLowerCase().replace(/ё/g, "е");
  if (/кто создател|кто создал|кто автор|who created|who made/.test(q)) {
    return "Создатель: Владимиров Роберт Павлович.";
  }
  if (/^(привет|здравств|хай|hello|hi)\b/.test(q)) {
    return userName ? `Привет, ${userName}. Я на связи.` : "Привет. Я на связи.";
  }
  const solved = trySolve(question);
  if (solved?.answer) return solved.answer;
  return "Я на связи. Могу ответить на задачу или нарисовать: напиши «нарисуй кота».";
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("timeout")), ms);
    })
  ]);
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

    if (wantsImage(question)) {
      const drawn = await generateImage(extractImagePrompt(question));
      image = drawn.dataUrl;
      answer = "Готово.";
    } else if (ai) {
      try {
        const prompt = [
          { role: "system", content: systemPrompt() },
          ...chatHistory.slice(-8).map(item => ({
            role: item.role === "assistant" ? "assistant" : "user",
            content: item.content
          }))
        ];
        const result = await withTimeout(ai(prompt, {
          max_new_tokens: 80,
          temperature: 0.7,
          do_sample: true,
          top_p: 0.9,
          repetition_penalty: 1.08
        }), 8000);
        answer = extractAnswer(result).trim();
      } catch (error) {
        console.warn("Модель не успела, отвечаю сразу:", error);
      }
    }

    if (!answer && !image) answer = localAnswer(question);

    removeTyping();

    chatHistory.push({
      role: "assistant",
      content: answer,
      image
    });

    addMessageToScreen("assistant", answer, image);
    saveCurrentChat();

    if (ai) setStatus(true);

  } catch (error) {
    removeTyping();
    console.error("Ошибка Pupik AI:", error);

    const errorMessage = localAnswer(question);
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

registerForm?.addEventListener("submit", event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  userName = name;
  localStorage.setItem(NAME_KEY, name);
  showApp();
});

startBootGame();
loadAI();
setTimeout(afterBoot, 1800);

console.log("Pupik AI запущен.");
