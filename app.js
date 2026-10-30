
import { pipeline, env } from
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

env.useBrowserCache = true;

// Модель
const MODEL = "onnx-community/Qwen2.5-1.5B-Instruct";

// Настройки агента
const SYSTEM_PROMPT = `
Ты — Pupik AI, самостоятельный искусственный интеллект.

Правила:
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

// Элементы страницы
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

// Проверка HTML
const requiredElements = {
  sidebar,
  statusText,
  statusDot,
  messagesElement,
  welcome,
  form,
  input,
  sendButton,
  historyElement,
  newChatButton,
  menuButton,
  titleElement
};

for (const [name, element] of Object.entries(requiredElements)) {
  if (!element) {
    throw new Error(`Не найден HTML-элемент: ${name}`);
  }
}

// Состояние
let ai = null;
let loadingPromise = null;
let generating = false;
let chatHistory = [];
let currentChatId = null;

let chats = [];

try {
  const saved = JSON.parse(
    localStorage.getItem("pupik_chats") || "[]"
  );

  if (Array.isArray(saved)) {
    chats = saved.filter(chat =>
      chat &&
      typeof chat.id === "string" &&
      Array.isArray(chat.messages)
    );
  }
} catch (error) {
  console.warn("Не удалось загрузить историю:", error);
}

// Статус
function setStatus(text, online = false) {
  statusText.textContent = text;
  statusDot.classList.toggle("online", online);
}

// Сохранение чатов
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

// Отображение списка чатов
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

// Создание нового чата
function createChat() {
  if (generating || loadingPromise) return;

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

// Открытие чата
function openChat(id) {
  if (generating || loadingPromise) return;

  const chat = chats.find(item => item.id === id);
  if (!chat) return;

  currentChatId = id;
  chatHistory = [...chat.messages];

  titleElement.textContent = chat.title || "Новый диалог";

  renderMessages();
  renderHistory();

  sidebar.classList.remove("open");
}

// Отрисовка всех сообщений
function renderMessages() {
  messagesElement.innerHTML = "";

  welcome.style.display =
    chatHistory.length > 0 ? "none" : "block";

  chatHistory.forEach(message => {
    addMessageToScreen(message.role, message.content);
  });

  messagesElement.scrollTop = messagesElement.scrollHeight;
}

// Добавление сообщения
function addMessageToScreen(role, content) {
  const message = document.createElement("div");

  message.className =
    "message " + (role === "user" ? "user-message" : "ai-message");

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

  body.appendChild(name);
  body.appendChild(text);

  message.appendChild(avatar);
  message.appendChild(body);

  messagesElement.appendChild(message);
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

// Индикатор генерации
function addTyping() {
  removeTyping();

  const typing = document.createElement("div");

  typing.className = "typing";
  typing.id = "typing";

  typing.innerHTML =
    "<span></span><span></span><span></span>";

  messagesElement.appendChild(typing);
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function removeTyping() {
  document.getElementById("typing")?.remove();
}

// Сохранение текущего чата
function saveCurrentChat() {
  const chat = chats.find(item => item.id === currentChatId);
  if (!chat) return;

  chat.messages = [...chatHistory];

  if (
    chatHistory.length > 0 &&
    chat.title === "Новый чат"
  ) {
    chat.title = chatHistory[0].content.slice(0, 32);
  }

  saveChats();
  renderHistory();

  titleElement.textContent = chat.title;
}

// Загрузка нейросети
async function loadAI() {
  if (ai) return ai;

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    sendButton.disabled = true;
    input.disabled = true;

    setStatus("Подключаем нейросеть…");

    try {
      const device = navigator.gpu ? "webgpu" : "wasm";

      console.log("Pupik AI");
      console.log("Модель:", MODEL);
      console.log("Устройство:", device);

      ai = await pipeline(
        "text-generation",
        MODEL,
        {
          dtype: "q4",
          device,

          progress_callback: info => {
            console.log("Загрузка модели:", info);

            if (info.status === "initiate") {
              setStatus("Начинаем загрузку модели…");
            }

            if (info.status === "download") {
              setStatus(
                "Скачиваем: " + (info.file || "файл модели")
              );
            }

            if (info.status === "progress") {
              const percent = Math.round(info.progress || 0);

              setStatus(`Загрузка модели: ${percent}%`);
            }

            if (info.status === "done") {
              setStatus("Файл загружен. Подготавливаем модель…");
            }
          }
        }
      );

      setStatus("Pupik AI готов!", true);

      console.log("Модель успешно загружена!");

      return ai;

    } catch (error) {
      ai = null;

      console.error("Ошибка загрузки модели:", error);

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

// Получение ответа модели
function extractAnswer(result) {
  const generated = result?.[0]?.generated_text;

  if (typeof generated === "string") {
    return generated;
  }

  if (Array.isArray(generated)) {
    const assistantMessage = [...generated]
      .reverse()
      .find(item =>
        item &&
        item.role === "assistant" &&
        typeof item.content === "string"
      );

    return assistantMessage?.content || "";
  }

  return "";
}

// Отправка сообщения
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
    // Загружаем модель при первом сообщении
    if (!ai) {
      await loadAI();
    }

    setStatus("Pupik AI думает…", true);

    const chat = [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      ...chatHistory.slice(-12)
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

    removeTyping();

    chatHistory.push({
      role: "assistant",
      content: answer
    });

    addMessageToScreen("assistant", answer);

    saveCurrentChat();

    setStatus("Pupik AI готов!", true);

  } catch (error) {
    removeTyping();

    console.error("Ошибка Pupik AI:", error);

    const errorMessage =
      "Не удалось получить ответ. Проверь интернет и консоль браузера. Подробности: " +
      (error.message || "неизвестная ошибка");

    chatHistory.push({
      role: "assistant",
      content: errorMessage
    });

    addMessageToScreen("assistant", errorMessage);

    saveCurrentChat();

    setStatus("Ошибка нейросети");
  }

  generating = false;

  sendButton.disabled = false;
  input.disabled = false;

  input.focus();
}

// Отправка формы
form.addEventListener("submit", event => {
  event.preventDefault();

  const text = input.value.trim();

  if (!text || generating) return;

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
newChatButton.addEventListener("click", createChat);

// Мобильное меню
menuButton.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

// Кнопки подсказок
document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => {
    const prompt = button.dataset.prompt;

    if (prompt) {
      sendMessage(prompt);
    }
  });
});

// Запуск
renderHistory();

if (chats.length > 0) {
  openChat(chats[0].id);
} else {
  currentChatId = null;
  chatHistory = [];
  renderMessages();
}

setStatus("Нейросеть загрузится после первого сообщения");

console.log("Pupik AI запущен.");
console.log("Модель:", MODEL);
