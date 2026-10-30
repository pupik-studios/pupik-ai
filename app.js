
import { pipeline, env } from
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

const MODEL = "onnx-community/Qwen2.5-1.5B-Instruct";

env.useBrowserCache = true;

const $ = id => document.getElementById(id);

const loadingScreen = $("loadingScreen");
const registerScreen = $("registerScreen");
const chatApp = $("chatApp");
const loadingPercent = $("loadingPercent");
const progressBar = $("progressBar");
const loadingStatus = $("loadingStatus");
const status = $("status");

const welcome = $("welcome");
const messages = $("messages");
const form = $("form");
const promptInput = $("prompt");
const sendButton = $("send");
const newChatButton = $("newChat");

let ai = null;
let loading = false;
let busy = false;
let history = [];

const SYSTEM_PROMPT = `
Ты — Pupik AI, самостоятельный искусственный интеллект.
Общайся дружелюбно и естественно.
Отвечай на вопросы, объясняй темы, помогай с идеями и программированием.
Не оценивай пользователя и его вопросы.
Не ставь баллы и рейтинги.
Не утверждай, что знаешь то, чего не знаешь.
Если пользователь пишет на русском, отвечай на русском.
Пиши понятно и по существу.
`;

function setProgress(value, message) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  loadingPercent.textContent = percent + "%";
  progressBar.style.width = percent + "%";
  if (message) loadingStatus.textContent = message;
}

function showRegistrationOrChat() {
  loadingScreen.hidden = true;
  window.pupikStopGame?.();

  const nickname = localStorage.getItem("pupik-nickname");

  if (nickname) {
    openChat(nickname);
  } else {
    registerScreen.hidden = false;
    $("nickname").focus();
  }
}

function openChat(nickname) {
  registerScreen.hidden = true;
  chatApp.hidden = false;

  $("profileName").textContent = nickname;
  $("welcomeName").textContent = nickname;

  restoreHistory();
}

$("registerForm").addEventListener("submit", event => {
  event.preventDefault();

  const nickname = $("nickname").value.trim();

  if (nickname.length < 2) {
    $("nickname").setCustomValidity("Введи минимум 2 символа");
    $("nickname").reportValidity();
    return;
  }

  $("nickname").setCustomValidity("");
  localStorage.setItem("pupik-nickname", nickname);
  openChat(nickname);
});

async function loadAI() {
  if (ai || loading) return;

  loading = true;
  setProgress(0, "Подготовка нейросети…");

  const progress = info => {
    if (info.status === "progress" &&
        typeof info.progress === "number") {
      setProgress(info.progress, "Загрузка нейросети…");
    } else if (info.status === "downloading") {
      loadingStatus.textContent = "Скачивание файлов модели…";
    } else if (info.status === "done") {
      loadingStatus.textContent = "Подготовка модели…";
    }
  };

  const options = {
    dtype: "q4",
    progress_callback: progress
  };

  try {
    if (navigator.gpu) {
      try {
        ai = await pipeline("text-generation", MODEL, {
          ...options,
          device: "webgpu"
        });
      } catch (error) {
        console.warn("WebGPU недоступен, пробуем WASM:", error);
      }
    }

    if (!ai) {
      ai = await pipeline("text-generation", MODEL, {
        ...options,
        device: "wasm"
      });
    }

    setProgress(100, "Pupik AI загружен!");
    status.textContent = "Pupik AI готов";

    setTimeout(showRegistrationOrChat, 500);

  } catch (error) {
    console.error("Ошибка загрузки модели:", error);
    loadingStatus.textContent =
      "Не удалось загрузить модель. Проверь интернет и попробуй снова.";

    const retry = document.createElement("button");
    retry.textContent = "Повторить загрузку";
    retry.className = "retry-button";
    retry.addEventListener("click", () => {
      retry.remove();
      loading = false;
      loadAI();
    });

    loadingScreen.querySelector(".game-content").appendChild(retry);

  } finally {
    loading = false;
  }
}

function addMessage(text, role) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role}`;

  const label = document.createElement("div");
  label.className = "role";
  label.textContent = role === "user"
    ? localStorage.getItem("pupik-nickname") || "Ты"
    : "Pupik AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  wrapper.append(label, bubble);
  messages.appendChild(wrapper);
  wrapper.scrollIntoView({ behavior: "smooth", block: "end" });
}

function updateWelcome() {
  welcome.hidden = history.length > 0;
}

function extractAnswer(result) {
  const generated = result?.[0]?.generated_text;

  if (typeof generated === "string") return generated;

  if (Array.isArray(generated)) {
    return generated[generated.length - 1]?.content || "";
  }

  return "";
}

async function sendMessage(text) {
  const question = text.trim();

  if (!question || busy) return;

  if (!ai) {
    addMessage("Нейросеть ещё загружается. Подожди окончания загрузки.", "assistant");
    return;
  }

  busy = true;
  sendButton.disabled = true;
  promptInput.disabled = true;

  addMessage(question, "user");
  history.push({ role: "user", content: question });

  promptInput.value = "";
  updateWelcome();
  status.textContent = "Pupik AI думает…";

  try {
    const chat = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-12)
    ];

    const result = await ai(chat, {
      max_new_tokens: 350,
      temperature: 0.7,
      do_sample: true,
      top_p: 0.9,
      repetition_penalty: 1.08
    });

    const answer = extractAnswer(result).trim() ||
      "Не получилось сформировать ответ. Попробуй ещё раз.";

    addMessage(answer, "assistant");
    history.push({ role: "assistant", content: answer });

    localStorage.setItem("pupik-history", JSON.stringify(history));
    status.textContent = "Pupik AI готов";

  } catch (error) {
    console.error("Ошибка генерации:", error);
    addMessage("Произошла ошибка при генерации ответа. Попробуй ещё раз.", "assistant");
    status.textContent = "Ошибка генерации";

  } finally {
    busy = false;
    sendButton.disabled = false;
    promptInput.disabled = false;
    promptInput.focus();
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  sendMessage(promptInput.value);
});

promptInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

newChatButton.addEventListener("click", () => {
  if (busy) return;

  history = [];
  localStorage.removeItem("pupik-history");
  messages.innerHTML = "";
  updateWelcome();
});

function restoreHistory() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("pupik-history") || "[]"
    );

    if (Array.isArray(saved)) {
      history = saved.filter(item =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
      );

      history.forEach(item => addMessage(item.content, item.role));
    }
  } catch (error) {
    console.warn("Не удалось восстановить историю:", error);
    history = [];
  }

  updateWelcome();
}

loadAI();

