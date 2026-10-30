
import { pipeline, env } from
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

env.useBrowserCache = true;

// Определяем iPhone и iPad
function isAppleMobile() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// Выбираем модель
const MODEL = isAppleMobile()
  ? "onnx-community/Qwen2.5-0.5B-Instruct"
  : "onnx-community/Qwen2.5-1.5B-Instruct";

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

Ты должен:
- Отвечать на вопросы пользователя.
- Объяснять сложные темы простыми словами.
- Помогать с программированием и идеями.
- Общаться дружелюбно.
- Не оценивать вопросы пользователя.
- Не ставить баллы и рейтинги.
- Не проверять качество вопросов.
- Не искать ответы в интернете.
- Не выдумывать факты.
- Если пользователь пишет по-русски, отвечать по-русски.
- Давать понятные и полезные ответы.
`;

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

// Диагностика
function printDiagnostics() {
  console.log("===== PUPIK AI =====");
  console.log("Модель:", MODEL);
  console.log("Браузер:", navigator.userAgent);
  console.log("Apple mobile:", isAppleMobile());
  console.log("WebGPU:", !!navigator.gpu);
  console.log("Память:", navigator.deviceMemory || "неизвестна");
  console.log("====================");
}

// Загрузка модели
async function loadAI() {
  if (ai || loading) return;

  loading = true;

  printDiagnostics();

  setStatus("Подключаем загрузчик…");

  try {
    console.log("Pupik AI: импорт загрузчика завершён");

    // На iPhone используем WASM.
    const device = isAppleMobile()
      ? "wasm"
      : (navigator.gpu ? "webgpu" : "wasm");

    console.log("Устройство:", device);
    console.log("Начинаем загрузку модели:", MODEL);

    setStatus("Начинаем загрузку модели…");

    ai = await pipeline(
      "text-generation",
      MODEL,
      {
        dtype: "q4",
        device,

        progress_callback: (info) => {
          console.log("Pupik progress:", info);

          if (
            info.status === "progress" &&
            typeof info.progress === "number"
          ) {
            setStatus(
              `Загрузка файла: ${Math.round(info.progress)}%`
            );
          }

          if (info.status === "downloading") {
            setStatus(
              `Скачивание: ${info.file || "файлов модели"}`
            );
          }

          if (info.status === "done") {
            setStatus("Файл загружен, подготовка…");
          }
        }
      }
    );

    console.log("Модель успешно загружена!");

    setStatus("Pupik AI готов к работе!");

  } catch (error) {
    console.error("PUPIK ERROR:", error);

    ai = null;

    setStatus(
      "Ошибка загрузки: " + (error.message || "неизвестная ошибка")
    );

  } finally {
    loading = false;
  }
}

// Получение ответа
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
    console.warn("Ошибка сохранения истории:", error);
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

  if (!ai) {
    await loadAI();
  }

  if (!ai) {
    addMessage(
      "Нейросеть не загрузилась. Проверь подключение и попробуй ещё раз.",
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
      max_new_tokens: 300,
      temperature: 0.7,
      do_sample: true,
      top_p: 0.9,
      repetition_penalty: 1.08
    });

    const answer =
      extractAnswer(result).trim() ||
      "Не получилось сформировать ответ.";

    addMessage(answer, "assistant");

    history.push({
      role: "assistant",
      content: answer
    });

    saveHistory();

    setStatus("Pupik AI готов!");

  } catch (error) {
    console.error("Ошибка генерации:", error);

    addMessage(
      "Ошибка генерации ответа: " + error.message,
      "assistant"
    );

    setStatus("Ошибка генерации");

  } finally {
    generating = false;

    sendButton.disabled = false;
    promptInput.disabled = false;

    promptInput.focus();
  }
}

// Форма отправки
form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(promptInput.value);
});

// Enter отправляет сообщение
promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
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
    ai ? "Pupik AI готов!" : "Нейросеть ещё не загружена"
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

      history.forEach((item) => {
        addMessage(item.content, item.role);
      });
    }
  } catch (error) {
    console.warn("Не удалось восстановить историю:", error);
    history = [];
  }

  updateWelcome();
}

// Запуск
restoreHistory();

setStatus("Запуск Pupik AI…");

loadAI();

