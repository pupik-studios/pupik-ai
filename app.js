
import { pipeline, env } from
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

env.useBrowserCache = true;

// Модель
function isAppleMobile() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1);
}

const MODEL = isAppleMobile()
  ? "onnx-community/Qwen2.5-0.5B-Instruct"
  : "onnx-community/Qwen2.5-1.5B-Instruct";

// Элементы нового index.html
const messagesElement = document.getElementById("messages");
const input = document.getElementById("messageInput");
const form = document.getElementById("chatForm");
const sendButton = document.getElementById("sendButton");
const welcome = document.getElementById("welcome");
const historyElement = document.getElementById("history");
const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");

const SYSTEM_PROMPT = `
Ты — Pupik AI, самостоятельный искусственный интеллект.

Правила:
- Отвечай на вопросы пользователя.
- Объясняй сложные темы простыми словами.
- Помогай с программированием, математикой и идеями.
- Общайся дружелюбно.
- Не оценивай вопросы пользователя.
- Не ставь баллы и рейтинги.
- Не проверяй качество вопросов.
- Не выдумывай факты.
- Если пользователь пишет по-русски, отвечай по-русски.
- Давай понятные и полезные ответы.
`;

let ai = null;
let loadingPromise = null;
let generating = false;
let chatHistory = [];
let chats = [];

try {
  const saved = JSON.parse(
    localStorage.getItem("pupik_chats") || "[]"
  );

  if (Array.isArray(saved)) chats = saved;
} catch (error) {
  console.warn("Ошибка чтения истории:", error);
}

let currentChatId = null;

// Проверка HTML
const requiredElements = {
  messagesElement,
  input,
  form,
  sendButton,
  welcome,
  historyElement,
  statusText,
  statusDot
};

for (const [name, element] of Object.entries(requiredElements)) {
  if (!element) {
    console.error("Не найден элемент HTML:", name);
  }
}

// Статус
function setStatus(text, online = false) {
  statusText.textContent = text;
  statusDot.classList.toggle("online", online);
}

// История чатов
function saveChats() {
  try {
    localStorage.setItem(
      "pupik_chats",
      JSON.stringify(chats)
    );
  } catch (error) {
    console.warn("Не удалось сохранить историю:", error);
  }
}

function createChat() {
  currentChatId = Date.now().toString();
  chatHistory = [];

  chats.unshift({
    id: currentChatId,
    title: "Новый чат",
    messages: []
  });

  saveChats();
  renderHistory();
  renderMessages();

  document.querySelector(".top-title").textContent =
    "Новый диалог";
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

    button.addEventListener("click", () => {
      openChat(chat.id);
    });

    historyElement.appendChild(button);
  });
}

function openChat(id) {
  const chat = chats.find(item => item.id === id);
  if (!chat) return;

  currentChatId = id;
  chatHistory = [...chat.messages];

  document.querySelector(".top-title").textContent =
    chat.title || "Новый чат";

  renderMessages();
  renderHistory();

  document.getElementById("sidebar").classList.remove("open");
}

function renderMessages() {
  messagesElement.innerHTML = "";

  welcome.style.display =
    chatHistory.length ? "none" : "block";

  chatHistory.forEach(message => {
    addMessageToScreen(message.role, message.content);
  });
}

function addMessageToScreen(role, content) {
  const message = document.createElement("div");

  message.className =
    "message " +
    (role === "user" ? "user-message" : "ai-message");

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "Я" : "P";

  const body = document.createElement("div");
  body.className = "message-body";

  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = role === "user" ? "Ты" : "Pupik AI";

  const text = document.createElement("div");
  text.className = "message-text";
  text.textContent = content;

  body.append(name, text);
  message.append(avatar, body);

  messagesElement.appendChild(message);
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function addTyping() {
  const typing = document.createElement("div");

  typing.className = "typing";
  typing.id = "typing";
  typing.textContent = "Pupik AI думает…";

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

  document.querySelector(".top-title").textContent =
    chat.title;
}

// Загрузка модели
async function loadAI() {
  if (ai) return ai;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    sendButton.disabled = true;
    input.disabled = true;

    try {
      console.log("Начинаем загрузку:", MODEL);
      console.log("WebGPU:", !!navigator.gpu);

      let loadedAI;

      if (navigator.gpu && !isAppleMobile()) {
        try {
          setStatus("Запускаем Qwen через WebGPU…");

          loadedAI = await pipeline(
            "text-generation",
            MODEL,
            {
              dtype: "q4",
              device: "webgpu",
              progress_callback: updateProgress
            }
          );
        } catch (gpuError) {
          console.warn(
            "WebGPU не запустился. Пробуем WASM:",
            gpuError
          );

          setStatus("Переключаемся на WASM…");

          loadedAI = await pipeline(
            "text-generation",
            MODEL,
            {
              dtype: "q4",
              device: "wasm",
              progress_callback: updateProgress
            }
          );
        }
      } else {
        setStatus("Загружаем Qwen через WASM…");

        loadedAI = await pipeline(
          "text-generation",
          MODEL,
          {
            dtype: "q4",
            device: "wasm",
            progress_callback: updateProgress
          }
        );
      }

      ai = loadedAI;

      console.log("Qwen успешно загружен!");
      setStatus("Pupik AI готов!", true);

      return ai;

    } catch (error) {
      console.error("ОШИБКА ЗАГРУЗКИ QWEN:", error);

      setStatus("Ошибка загрузки модели");

      throw error;

    } finally {
      loadingPromise = null;
      sendButton.disabled = false;
      input.disabled = false;
    }
  })();

  return loadingPromise;
}

// Прогресс загрузки
function updateProgress(info) {
  console.log("Pupik progress:", info);

  if (
    info.status === "progress" &&
    typeof info.progress === "number"
  ) {
    setStatus(
      `Загрузка модели: ${Math.round(info.progress)}%`
    );
  } else if (info.status === "downloading") {
    setStatus("Скачиваем файлы модели…");
  } else if (info.status === "done") {
    setStatus("Файлы скачаны. Подготавливаем Qwen…");
  }
}

// Извлечение ответа
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

// Отправка сообщения
async function sendMessage(text) {
  text = text.trim();

  if (!text || generating) return;

  if (!currentChatId) createChat();

  generating = true;
  sendButton.disabled = true;
  input.disabled = true;

  chatHistory.push({
    role: "user",
    content: text
  });

  addMessageToScreen("user", text);
  welcome.style.display = "none";

  saveCurrentChat();
  addTyping();

  try {
    if (!ai) {
      await loadAI();
    }

    setStatus("Pupik AI думает…", true);

    const conversation = [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      ...chatHistory.slice(-12)
    ];

    const result = await ai(conversation, {
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

    setStatus("Pupik AI готов!", true);

  } catch (error) {
    console.error("Ошибка:", error);

    removeTyping();

    addMessageToScreen(
      "Ошибка загрузки или генерации. Подробности находятся в Console.",
      "assistant"
    );

    setStatus("Ошибка нейросети");
  } finally {
    generating = false;
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

// Форма
form.addEventListener("submit", event => {
  event.preventDefault();

  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  input.style.height = "auto";

  sendMessage(text);
});

// Автоматическая высота поля
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height =
    Math.min(input.scrollHeight, 160) + "px";
});

// Enter отправляет сообщение
input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

// Новый чат
document.getElementById("newChat").addEventListener(
  "click",
  () => {
    if (generating || loadingPromise) return;
    createChat();
  }
);

// Меню
document.getElementById("menuButton").addEventListener(
  "click",
  () => {
    document.getElementById("sidebar").classList.toggle("open");
  }
);

// Кнопки примеров
document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt || button.textContent.trim();
    form.requestSubmit();
  });
});

// Запуск
renderHistory();

if (chats.length) {
  openChat(chats[0].id);
} else {
  createChat();
}

setStatus("Qwen ещё не загружен");

console.log("Pupik AI запущен.");
console.log("Модель загрузится после первого сообщения.");
