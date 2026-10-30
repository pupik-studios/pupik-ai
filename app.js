
import { pipeline, env } from
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";

const MODEL = "onnx-community/Qwen2.5-1.5B-Instruct";

env.useBrowserCache = true;

const status = document.getElementById("status");
const welcome = document.getElementById("welcome");
const messages = document.getElementById("messages");
const form = document.getElementById("form");
const promptInput = document.getElementById("prompt");
const sendButton = document.getElementById("send");
const newChatButton = document.getElementById("newChat");

let ai = null;
let busy = false;
let history = [];

const SYSTEM_PROMPT = `
Ты — Pupik AI, самостоятельный искусственный интеллект.
Ты общаешься с пользователем дружелюбно и естественно.
Отвечай на вопросы, объясняй темы, помогай с идеями и программированием.
Не оценивай пользователя и его вопросы.
Не ставь баллы, рейтинги и оценки.
Не проверяй качество вопроса.
Не ищи ответы в интернете.
Не утверждай, что знаешь то, чего не знаешь.
Если пользователь пишет на русском, отвечай на русском.
Пиши понятно и по существу.
`;

function setStatus(text) {
  status.textContent = text;
}

function addMessage(text, role) {
  const element = document.createElement("div");
  element.className = `message ${role}`;
  element.textContent = text;
  messages.appendChild(element);
  messages.scrollTop = messages.scrollHeight;
  return element;
}

function updateWelcome() {
  welcome.style.display = history.length ? "none" : "flex";
}

async function loadAI() {
  if (ai || busy) return;

  busy = true;
  setStatus("Загрузка нейросети…");

  const progress = (info) => {
    if (info.status === "progress" &&
        typeof info.progress === "number") {
      setStatus(`Загрузка нейросети: ${Math.round(info.progress)}%`);
    } else if (info.status === "downloading") {
      setStatus("Скачивание модели…");
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

    setStatus("Pupik AI готов");
  } catch (error) {
    console.error("Ошибка загрузки:", error);
    setStatus("Ошибка загрузки модели");
  } finally {
    busy = false;
  }
}

function extractAnswer(result) {
  const generated = result?.[0]?.generated_text;

  if (typeof generated === "string") {
    return generated;
  }

  if (Array.isArray(generated)) {
    return generated[generated.length - 1]?.content || "";
  }

  return "";
}

async function sendMessage(text) {
  const question = text.trim();

  if (!question || busy) return;

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
      "Не удалось загрузить нейросеть. Проверь интернет и обнови страницу.",
      "assistant"
    );
    return;
  }

  busy = true;
  sendButton.disabled = true;
  promptInput.disabled = true;
  setStatus("Pupik AI думает…");

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

    history.push({
      role: "assistant",
      content: answer
    });

    localStorage.setItem("pupik-history", JSON.stringify(history));

    setStatus("Pupik AI готов");
  } catch (error) {
    console.error("Ошибка ответа:", error);

    addMessage(
      "Произошла ошибка при генерации ответа. Попробуй ещё раз.",
      "assistant"
    );

    setStatus("Ошибка генерации");
  } finally {
    busy = false;
    sendButton.disabled = false;
    promptInput.disabled = false;
    promptInput.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(promptInput.value);
});

newChatButton.addEventListener("click", () => {
  if (busy) return;

  history = [];
  localStorage.removeItem("pupik-history");
  messages.innerHTML = "";
  updateWelcome();
});

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    sendMessage(button.textContent);
  });
});

promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

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
    console.warn("Не удалось восстановить историю:", error);
    history = [];
  }

  updateWelcome();
}

restoreHistory();
loadAI();
