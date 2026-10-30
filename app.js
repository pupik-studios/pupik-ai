
import { pipeline, env } from
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

env.useBrowserCache = true;

const MODEL = "onnx-community/Qwen2.5-1.5B-Instruct";

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
  statusText.textContent = "Pupik AI";
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
    addMessageToScreen(message.role, message.content);
  });

  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function addMessageToScreen(role, content) {
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

  const text = document.createElement("div");
  text.className = "message-text";
  text.textContent = content;

  body.appendChild(name);
  body.appendChild(text);
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

function setBoot(text, percent) {
  if (bootStatus) bootStatus.textContent = text;
  if (bootBar && typeof percent === "number") {
    bootBar.style.width = `${Math.max(4, Math.min(100, percent))}%`;
  }
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

  setBoot("Загрузка Qwen…", 6);

  loadingPromise = (async () => {
    try {
      const device = navigator.gpu ? "webgpu" : "wasm";

      console.log("Pupik AI: подготовка модели", MODEL);
      console.log("Устройство:", device);

      ai = await pipeline("text-generation", MODEL, {
        dtype: "q4",
        device,
        progress_callback: info => {
          console.log("Pupik progress:", info);
          if (info.status === "progress" && typeof info.progress === "number") {
            setBoot(`Загрузка Qwen: ${Math.round(info.progress)}%`, info.progress);
          } else if (info.status === "initiate" || info.status === "download") {
            setBoot("Скачивание Qwen…", 8);
          }
        }
      });

      setStatus(true);
      setBoot("Qwen готов", 100);
      console.log("Pupik AI готов!");

      return ai;

    } catch (error) {
      ai = null;
      console.error("Ошибка модели:", error);
      setBoot("Не удалось загрузить Qwen", 100);
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
    if (!ai) {
      await loadAI();
    }

    const prompt = [
      { role: "system", content: systemPrompt() },
      ...chatHistory.slice(-12)
    ];

    const result = await ai(prompt, {
      max_new_tokens: 300,
      temperature: 0.7,
      do_sample: true,
      top_p: 0.9,
      repetition_penalty: 1.08
    });

    const answer =
      extractAnswer(result).trim() ||
      "Не получилось сформировать ответ.";

    removeTyping();

    chatHistory.push({
      role: "assistant",
      content: answer
    });

    addMessageToScreen("assistant", answer);
    saveCurrentChat();

    setStatus(true);

  } catch (error) {
    removeTyping();

    console.error("Ошибка Pupik AI:", error);

    const errorMessage =
      "Не удалось получить ответ. Попробуй ещё раз.";

    chatHistory.push({
      role: "assistant",
      content: errorMessage
    });

    addMessageToScreen("assistant", errorMessage);
    saveCurrentChat();

    setStatus(false);

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

loadAI();

console.log("Pupik AI запущен.");
