
import { pipeline, env } from
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

const MODEL = "onnx-community/Qwen2.5-1.5B-Instruct";

env.useBrowserCache = true;

// Элементы страницы
const status = document.getElementById("status");
const welcome = document.getElementById("welcome");
const messages = document.getElementById("messages");
const form = document.getElementById("form");
const promptInput = document.getElementById("prompt");
const sendButton = document.getElementById("send");
const newChatButton = document.getElementById("newChat");

// Состояние
let ai = null;
let loading = false;
let generating = false;
let history = [];

const SYSTEM_PROMPT = `
Ты — Pupik AI, самостоятельный искусственный интеллект.

Твои задачи:
- Отвечай на вопросы пользователя.
- Объясняй сложные темы простыми словами.
- Помогай с программированием, идеями и обучением.
- Общайся дружелюбно.
- Не оценивай пользователя и его вопросы.
- Не ставь баллы и рейтинги.
- Не проверяй качество вопросов.
- Не ищи ответы в интернете.
- Не утверждай, что знаешь то, чего не знаешь.
- Если пользователь пишет по-русски, отвечай по-русски.
- Отвечай понятно и по существу.
`;

// Определяем Safari
function isSafari() {
  const ua = navigator.userAgent;

  return (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Safari/.test(ua) &&
      !/Chrome|CriOS|Edg|OPR|Firefox/.test(ua))
  );
}

// Статус
function setStatus(text) {
  if (status) {
    status.textContent = text;
  }
}

// Добавление сообщения
function addMessage(text, role) {
  const element = document.createElement("div");

  element.className = `message ${role}`;
  element.textContent = text;

  messages.appendChild(element);

  messages.scrollTop = messages.scrollHeight;

  return element;
}

// Приветственный экран
function updateWelcome() {
  if (welcome) {
    welcome.style.display = history.length ? "none" : "flex";
  }
}

// Загрузка нейросети
async function loadAI() {
  if (ai || loading) return;

  loading = true;

  setStatus("Подготовка нейросети…");

  // Safari сразу запускается через WASM.
  const device = isSafari()
    ? "wasm"
    : (navigator.gpu ? "webgpu" : "wasm");

  // Прогресс загрузки отдельных файлов.
  const fileProgress = new Map();

  const progress = (info) => {
    const file = info.file || "Файл модели";

    if (
      info.status === "progress" &&
      typeof info.progress === "number"
    ) {
      fileProgress.set(file, info.progress);

      const percent = Math.round(info.progress);

      setStatus(
        `Загрузка: ${file} — ${percent}%`
      );
    }

    if (info.status === "downloading") {
      setStatus(`Скачивание: ${file}`);
    }

    if (info.status === "done") {
      setStatus(`Файл загружен: ${file}`);
    }
  };

  try {
    setStatus(
      isSafari()
        ? "Загрузка для Safari через WASM…"
        : "Загрузка нейросети…"
    );

    ai = await pipeline(
      "text-generation",
      MODEL,
      {
        dtype: "q4",
        device,
        progress_callback: progress
      }
    );

    setStatus("Pupik AI готов к работе!");

  } catch (error) {
    console.error("Ошибка загрузки модели:", error);

    ai = null;

    setStatus(
      "Не удалось загрузить модель. Проверь интернет и память устройства."
    );

  } finally {
    loading = false;
  }
}

// Получение текста ответа
function extractAnswer(result) {
  const generated = result?.[0]?.generated_text;

  if (typeof generated === "string") {
    return generated;
  }

  if (Array.isArray(generated)) {
    const last = generated[generated.length - 1];

    return last?.content || "";
  }

  return "";
}

// Сохранение истории
function saveHistory() {
  try {
    localStorage.setItem(
      "pupik-history",
      JSON.stringify(history)
    );
  } catch (error) {
    console.warn("Не удалось сохранить историю:", error);
  }
}

// Отправка сообщения
async function sendMessage(text) {
  const question = text.trim();

  if (!question || loading || generating) return;

  addMessage(question, "user");

  history.push({
    role: "user",
    content: question
  });

  promptInput.value = "";

  updateWelcome();

  // Загружаем модель, если она ещё не загружена.
  if (!ai) {
    await loadAI();
  }

  if (!ai) {
    addMessage(
      "Не получилось загрузить нейросеть. Попробуй обновить страницу.",
      "assistant"
    );

    return;
  }

  generating = true;

  sendButton.disabled = true;
  promptInput.disabled = true;

  setStatus("Pupik AI думает…");

  try {
    const chat = [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },

      ...history.slice(-12)
    ];

    const result = await ai(chat, {
      max_new_tokens: 350,
      temperature: 0.7,
      do_sample: true,
      top_p: 0.9,
      repetition_penalty: 1.08
    });

    const answer =
      extractAnswer(result).trim() ||
      "Не получилось сформировать ответ. Попробуй задать вопрос иначе.";

    addMessage(answer, "assistant");

    history.push({
      role: "assistant",
      content: answer
    });

    saveHistory();

    setStatus("Pupik AI готов к работе!");

  } catch (error) {
    console.error("Ошибка генерации:", error);

    addMessage(
      "Произошла ошибка при создании ответа. Попробуй ещё раз.",
      "assistant"
    );

    setStatus("Ошибка генерации.");

  } finally {
    generating = false;

    sendButton.disabled = false;
    promptInput.disabled = false;

    promptInput.focus();
  }
}

// Отправка через форму
form.addEventListener("submit", (event) => {
  event.preventDefault();

  sendMessage(promptInput.value);
});

// Enter отправляет, Shift + Enter переносит строку
promptInput.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" &&
    !event.shiftKey
  ) {
    event.preventDefault();

    form.requestSubmit();
  }
});

// Новый чат
newChatButton.addEventListener("click", () => {
  if (loading || generating) return;

  history = [];

  localStorage.removeItem("pupik-history");

  messages.innerHTML = "";

  updateWelcome();

  setStatus(
    ai
      ? "Pupik AI готов к работе!"
      : "Нейросеть ещё не загружена."
  );
});

// Кнопки примеров
document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    sendMessage(button.textContent);
  });
});

// Восстановление истории
function restoreHistory() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("pupik-history") || "[]"
    );

    if (Array.isArray(saved)) {
      history = saved.filter((item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
      );

      for (const item of history) {
        addMessage(item.content, item.role);
      }
    }

  } catch (error) {
    console.warn("Ошибка восстановления истории:", error);

    history = [];
  }

  updateWelcome();
}

// Запуск
restoreHistory();
loadAI();
