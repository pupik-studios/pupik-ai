import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

const MODEL = "onnx-community/Qwen2.5-1.5B-Instruct";
const NAME_KEY = "pupik_user_name";

env.useBrowserCache = true;

const boot = document.getElementById("boot");
const bootStatus = document.getElementById("bootStatus");
const bootBar = document.getElementById("bootBar");
const register = document.getElementById("register");
const registerForm = document.getElementById("registerForm");
const nameInput = document.getElementById("nameInput");
const messagesElement = document.getElementById("messages");
const input = document.getElementById("messageInput");
const form = document.getElementById("chatForm");
const sendButton = document.getElementById("sendButton");
const welcome = document.getElementById("welcome");
const historyElement = document.getElementById("history");
const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const profileName = document.getElementById("profileName");
const profileIcon = document.getElementById("profileIcon");

let ai = null;
let modelReady = false;
let modelError = "";
let waiting = false;
let userName = localStorage.getItem(NAME_KEY) || "";
let chatHistory = [];
let chats = JSON.parse(localStorage.getItem("pupik_chats") || "[]");
let currentChatId = null;

function systemPrompt() {
  return `Ты — Pupik AI на модели Qwen.
Создатель: Владимиров Роберт Павлович.
Пользователя зовут ${userName || "друг"}.
Отвечай дружелюбно и по существу, на языке пользователя.
Не выдумывай факты, которых не знаешь.`;
}

function setBoot(text, percent) {
  bootStatus.textContent = text;
  if (typeof percent === "number") {
    bootBar.style.width = `${Math.max(4, Math.min(100, percent))}%`;
  }
}

function showApp() {
  boot.hidden = true;
  register.hidden = true;
  applyName();
  if (!chats.length) createChat();
  else openChat(chats[0].id);
  if (modelReady) {
    statusDot.classList.add("online");
    statusText.textContent = "Qwen готов";
  } else {
    statusDot.classList.remove("online");
    statusText.textContent = modelError || "Qwen не загрузился";
  }
  input.focus();
}

function applyName() {
  const name = userName || "Pupik User";
  profileName.textContent = name;
  profileIcon.textContent = name.trim().charAt(0).toUpperCase() || "P";
}

function afterBoot() {
  if (!userName) {
    boot.hidden = true;
    register.hidden = false;
    nameInput.focus();
    return;
  }
  showApp();
}

async function loadAI() {
  setBoot("Загрузка Qwen…", 4);

  const progress = (info) => {
    if (info.status === "progress" && typeof info.progress === "number") {
      setBoot(`Загрузка Qwen: ${Math.round(info.progress)}%`, info.progress);
    } else if (info.status === "initiate" || info.status === "download") {
      setBoot("Скачивание Qwen…", 8);
    }
  };

  const options = { dtype: "q4", progress_callback: progress };

  try {
    if (navigator.gpu) {
      try {
        ai = await pipeline("text-generation", MODEL, { ...options, device: "webgpu" });
      } catch (error) {
        console.warn("WebGPU недоступен, пробуем WASM:", error);
      }
    }
    if (!ai) {
      ai = await pipeline("text-generation", MODEL, { ...options, device: "wasm" });
    }
    modelReady = true;
    setBoot("Qwen готов", 100);
  } catch (error) {
    console.error(error);
    modelError = "Не удалось загрузить Qwen";
    setBoot(modelError, 100);
  }
  afterBoot();
}

function saveChats() {
  localStorage.setItem("pupik_chats", JSON.stringify(chats));
}

function createChat() {
  currentChatId = Date.now().toString();
  chatHistory = [];
  chats.unshift({ id: currentChatId, title: "Новый чат", messages: [] });
  saveChats();
  renderHistory();
  renderMessages();
  document.querySelector(".top-title").textContent = "Новый диалог";
  input.focus();
}

function renderHistory() {
  historyElement.innerHTML = "";
  chats.forEach((chat) => {
    const button = document.createElement("button");
    button.className = "history-item";
    button.textContent = chat.title || "Новый чат";
    if (chat.id === currentChatId) button.classList.add("active");
    button.addEventListener("click", () => openChat(chat.id));
    historyElement.appendChild(button);
  });
}

function openChat(id) {
  const chat = chats.find((item) => item.id === id);
  if (!chat) return;
  currentChatId = id;
  chatHistory = [...chat.messages];
  document.querySelector(".top-title").textContent = chat.title;
  renderMessages();
  renderHistory();
  document.getElementById("sidebar").classList.remove("open");
}

function renderMessages() {
  messagesElement.innerHTML = "";
  welcome.style.display = chatHistory.length ? "none" : "block";
  chatHistory.forEach((message) => addMessageToScreen(message.role, message.content));
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function addMessageToScreen(role, content) {
  const message = document.createElement("div");
  message.className = "message " + (role === "user" ? "user-message" : "ai-message");

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? (userName || "Я").charAt(0).toUpperCase() : "P";

  const body = document.createElement("div");
  body.className = "message-body";

  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = role === "user" ? userName || "Ты" : "Pupik AI";

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
  const typing = document.createElement("div");
  typing.className = "typing";
  typing.id = "typing";
  typing.innerHTML = "<span></span><span></span><span></span>";
  messagesElement.appendChild(typing);
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function removeTyping() {
  document.getElementById("typing")?.remove();
}

function saveCurrentChat() {
  const chat = chats.find((item) => item.id === currentChatId);
  if (!chat) return;
  chat.messages = [...chatHistory];
  if (chatHistory.length && chat.title === "Новый чат") {
    chat.title = chatHistory[0].content.slice(0, 32);
  }
  saveChats();
  renderHistory();
  document.querySelector(".top-title").textContent = chat.title;
}

function extractAnswer(result) {
  const generated = result?.[0]?.generated_text;
  if (typeof generated === "string") return generated;
  if (Array.isArray(generated)) return generated[generated.length - 1]?.content || "";
  return "";
}

async function sendMessage(text) {
  text = text.trim();
  if (!text || waiting) return;
  if (!currentChatId) createChat();

  waiting = true;
  sendButton.disabled = true;
  input.disabled = true;
  welcome.style.display = "none";

  chatHistory.push({ role: "user", content: text });
  addMessageToScreen("user", text);
  saveCurrentChat();
  addTyping();

  try {
    if (!ai) throw new Error(modelError || "Модель не загружена");

    statusText.textContent = "Qwen думает…";
    const chat = [
      { role: "system", content: systemPrompt() },
      ...chatHistory.slice(-12).map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: item.content
      }))
    ];

    const result = await ai(chat, {
      max_new_tokens: 350,
      temperature: 0.7,
      do_sample: true,
      top_p: 0.9,
      repetition_penalty: 1.08
    });

    const answer = extractAnswer(result).trim() || "Не получилось сформировать ответ. Попробуй ещё раз.";
    removeTyping();
    chatHistory.push({ role: "assistant", content: answer });
    addMessageToScreen("assistant", answer);
    saveCurrentChat();
    statusText.textContent = "Qwen готов";
    statusDot.classList.add("online");
  } catch (error) {
    console.error(error);
    removeTyping();
    const errorMessage = modelReady
      ? "Ошибка генерации. Попробуй ещё раз."
      : "Qwen не загрузился. Проверь интернет и обнови страницу.";
    chatHistory.push({ role: "assistant", content: errorMessage });
    addMessageToScreen("assistant", errorMessage);
    saveCurrentChat();
    statusText.textContent = "Ошибка";
  }

  waiting = false;
  sendButton.disabled = false;
  input.disabled = false;
  input.focus();
}

registerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  userName = name;
  localStorage.setItem(NAME_KEY, name);
  showApp();
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value;
  if (!text.trim()) return;
  input.value = "";
  input.style.height = "auto";
  sendMessage(text);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.getElementById("newChat").addEventListener("click", createChat);
document.getElementById("menuButton").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt;
    form.requestSubmit();
  });
});

loadAI();
