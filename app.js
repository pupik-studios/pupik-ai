
import { createPupikBrain } from "./brain.js?v=9";
import { generateImage } from "./generate.js?v=9";

const STORE_KEY = "pupik-ai-chats-v5";

const log = document.getElementById("log");
const form = document.getElementById("composer");
const input = document.getElementById("input");
const fileInput = document.getElementById("file");
const clearBtn = document.getElementById("clear-chat");
const newChatBtn = document.getElementById("new-chat");
const chatListEl = document.getElementById("chat-list");
const statusEl = document.getElementById("status");

if (!log || !form || !input || !fileInput || !clearBtn || !newChatBtn || !chatListEl || !statusEl) {
  console.error(
    "Pupik AI: не найдены элементы интерфейса. " +
    "Проверь index.html: нужны ID log, composer, input, file, " +
    "clear-chat, new-chat, chat-list и status."
  );
} else {
  let chats = [];
  let activeId = "";
  let brain;

  function uid() {
    return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function loadStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");

      if (raw && Array.isArray(raw.chats) && raw.chats.length) {
        chats = raw.chats.map((c) => ({
          id: c.id || uid(),
          title: c.title || "Чат",
          messages: Array.isArray(c.messages) ? c.messages : [],
          brain: c.brain || null,
          updated: c.updated || Date.now(),
        }));

        activeId =
          raw.activeId && chats.some((c) => c.id === raw.activeId)
            ? raw.activeId
            : chats[0].id;

        return;
      }
    } catch (error) {
      console.warn("Не удалось загрузить историю чатов:", error);
    }

    const id = uid();

    chats = [{
      id,
      title: "Чат 1",
      messages: [],
      brain: null,
      updated: Date.now(),
    }];

    activeId = id;
  }

  function saveStore() {
    const active = chats.find((c) => c.id === activeId);

    if (active && brain) {
      active.brain = brain.snapshot();
    }

    const pack = {
      activeId,
      chats: chats.map((c) => ({
        id: c.id,
        title: c.title,
        messages: c.messages.slice(-120).map((m) => {
          if (m.image && m.image.length > 180000) {
            return {
              ...m,
              image: "",
              text: (m.text || "") +
                "\n[Картинка не сохранена: слишком большой размер]",
            };
          }

          return m;
        }),
        brain: c.id === activeId && brain ? brain.snapshot() : c.brain,
        updated: c.updated,
      })),
    };

    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(pack));
    } catch (error) {
      pack.chats.forEach((c) => {
        c.messages = c.messages.map((m) =>
          m.image ? { ...m, image: "" } : m
        );
      });

      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(pack));
      } catch (secondError) {
        console.warn("Не удалось сохранить историю:", secondError);
      }
    }
  }

  function activeChat() {
    return chats.find((c) => c.id === activeId);
  }

  function scrollBottom() {
    requestAnimationFrame(() => {
      log.scrollTop = log.scrollHeight;
    });
  }

  function fillBubble(bubble, message) {
    bubble.textContent = "";

    if (message.text) {
      const p = document.createElement("div");
      p.className = "bubble-text";
      p.textContent = message.text;
      bubble.appendChild(p);
    }

    if (message.image) {
      const img = document.createElement("img");
      img.className = "bubble-img";
      img.src = message.image;
      img.alt = message.alt || "Изображение";
      img.addEventListener("load", scrollBottom);
      bubble.appendChild(img);
    }

    if (message.fileName && !message.image) {
      const file = document.createElement("div");
      file.className = "bubble-file";
      file.textContent = `📄 ${message.fileName}`;
      bubble.appendChild(file);
    }
  }

  function renderMessages(messages) {
    log.innerHTML = "";

    for (const message of messages) {
      const row = document.createElement("div");
      row.className = `row ${message.role}`;

      const bubble = document.createElement("div");
      bubble.className = "bubble";

      fillBubble(bubble, message);
      row.appendChild(bubble);
      log.appendChild(row);
    }

    scrollBottom();
  }

  function pushMessage(message) {
    const chat = activeChat();
    if (!chat) return;

    chat.messages.push(message);
    chat.updated = Date.now();

    if (
      message.role === "user" &&
      chat.title.startsWith("Чат") &&
      chat.messages.filter((m) => m.role === "user").length === 1
    ) {
      const title = message.text || message.fileName || "Чат";
      chat.title = title.slice(0, 28) + (title.length > 28 ? "…" : "");
    }

    const row = document.createElement("div");
    row.className = `row ${message.role}`;

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    fillBubble(bubble, message);
    row.appendChild(bubble);
    log.appendChild(row);

    scrollBottom();
    renderChatList();
    saveStore();
  }

  function setTyping(on) {
    const lang = brain?.getLang?.() || "ru";

    statusEl.textContent = on
      ? lang === "en" ? "Pupik is thinking…" : "Pupik думает…"
      : lang === "en" ? "online" : "на связи";

    statusEl.dataset.state = on ? "busy" : "idle";
  }

  function renderChatList() {
    const sorted = [...chats].sort((a, b) => b.updated - a.updated);
    chatListEl.innerHTML = "";

    for (const chat of sorted) {
      const row = document.createElement("div");
      row.className = "chat-row";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "chat-item" + (chat.id === activeId ? " on" : "");
      button.textContent = chat.title;
      button.title = chat.title;
      button.addEventListener("click", () => switchChat(chat.id));

      const del = document.createElement("button");
      del.type = "button";
      del.className = "chat-del";
      del.title = "Удалить чат";
      del.setAttribute("aria-label", "Удалить чат");
      del.textContent = "×";

      del.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteChat(chat.id);
      });

      row.append(button, del);
      chatListEl.appendChild(row);
    }
  }

  function deleteChat(id) {
    if (chats.length <= 1) {
      resetActiveChat();
      activeChat().title = "Чат";
      renderChatList();
      saveStore();
      return;
    }

    const wasActive = id === activeId;
    chats = chats.filter((c) => c.id !== id);

    if (wasActive) {
      activeId = [...chats].sort((a, b) => b.updated - a.updated)[0].id;

      const chat = activeChat();
      brain = createPupikBrain(chat.brain);

      if (!chat.messages.length) {
        chat.messages.push({ role: "ai", text: brain.greeting() });
      }

      renderMessages(chat.messages);
    }

    renderChatList();
    saveStore();
    input.focus();
  }

  function switchChat(id) {
    if (id === activeId) return;

    saveStore();
    activeId = id;

    const chat = activeChat();
    brain = createPupikBrain(chat.brain);

    if (!chat.messages.length) {
      chat.messages.push({ role: "ai", text: brain.greeting() });
    }

    renderMessages(chat.messages);
    renderChatList();
    saveStore();
    input.focus();
  }

  function createChat() {
    saveStore();

    const id = uid();
    const chatNumber = chats.length + 1;

    const chat = {
      id,
      title: `Чат ${chatNumber}`,
      messages: [],
      brain: null,
      updated: Date.now(),
    };

    chats.unshift(chat);
    activeId = id;
    brain = createPupikBrain();

    chat.messages.push({ role: "ai", text: brain.greeting() });

    renderMessages(chat.messages);
    renderChatList();
    saveStore();
    input.focus();
  }

  function resetActiveChat() {
    const chat = activeChat();
    if (!chat || !brain) return;

    const message = brain.resetConversation();

    chat.messages = [{ role: "ai", text: message }];
    chat.brain = brain.snapshot();
    chat.title = "Чат";
    chat.updated = Date.now();

    renderMessages(chat.messages);
    renderChatList();
    saveStore();
    setTyping(false);
  }

  function normalizeReply(answer) {
    if (answer && typeof answer === "object") return answer;
    return { type: "text", text: String(answer || "") };
  }

  function lastUserPhoto() {
    const chat = activeChat();

    for (let i = chat.messages.length - 1; i >= 0; i--) {
      const message = chat.messages[i];

      if (message.role === "user" && message.image) {
        return message.image;
      }
    }

    return "";
  }

  // Обрабатываем только команды файлового агента.
  // Остальные сообщения по-прежнему отправляются в brain.js.
  function isAgentFileCommand(text) {
    const command = text.trim();

    return (
      /^(покажи|список)\s+(файлы|файлов)$/i.test(command) ||
      /^list files$/i.test(command) ||
      /^(прочитай|открой|покажи код файла)\s+[\w .()-]+\.(js|mjs|cjs|html|css|json|md|txt|py|ts)$/i.test(command)
    );
  }

  async function speak(userText) {
    pushMessage({ role: "user", text: userText });

    // Если включён режим агента и команда относится к файлам,
    // передаём её AgentMode. Он показывает запрос разрешения.
    if (
      window.AgentMode?.isEnabled?.() &&
      isAgentFileCommand(userText)
    ) {
      setTyping(false);

      try {
        const handled = window.AgentMode.handleCommand(userText);

        if (!handled) {
          pushMessage({
            role: "ai",
            text: "Не удалось обработать команду агента.",
          });
        }
      } catch (error) {
        pushMessage({
          role: "ai",
          text: "Ошибка агента: " + (error?.message || String(error)),
        });
      }

      return;
    }

    setTyping(true);

    try {
      const delay = 380 + Math.min(900, userText.length * 12);
      await new Promise((resolve) => setTimeout(resolve, delay));

      const answer = normalizeReply(brain.reply(userText));

      if (answer.type === "image") {
        await new Promise((resolve) => setTimeout(resolve, 280));

        const photo = answer.usePhoto ? lastUserPhoto() : "";

        if (answer.usePhoto && !photo) {
          pushMessage({
            role: "ai",
            text:
              brain.getLang() === "en"
                ? "Send your photo with 📎 first, then ask again."
                : "Сначала прикрепи фото через 📎, а потом повтори запрос.",
          });

          return;
        }

        const image = await generateImage(answer.prompt || userText, {
          photoDataUrl: photo || undefined,
        });

        pushMessage({
          role: "ai",
          text: answer.text,
          image: image.dataUrl,
          alt: answer.prompt || "generated",
        });
      } else {
        pushMessage({ role: "ai", text: answer.text });
      }
    } catch (error) {
      console.error("Ошибка ответа Pupik AI:", error);

      pushMessage({
        role: "ai",
        text: "Произошла ошибка при обработке запроса. Проверь консоль браузера.",
      });
    } finally {
      setTyping(false);
    }
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  async function handleFiles(fileList) {
    const files = [...fileList];
    if (!files.length) return;

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isText =
        file.type.startsWith("text/") ||
        /\.(txt|md|json|csv|js|ts|py|html|css|log|svg|mjs|cjs)$/i.test(file.name);

      try {
        if (isImage) {
          const dataUrl = await readFileAsDataURL(file);

          pushMessage({
            role: "user",
            text: `Файл: ${file.name}`,
            image: dataUrl,
            fileName: file.name,
            alt: file.name,
          });

          setTyping(true);

          const answer = normalizeReply(
            brain.replyFile({
              kind: "image",
              name: file.name,
              size: file.size,
              mime: file.type,
            })
          );

          pushMessage({ role: "ai", text: answer.text });
        } else if (isText) {
          const text = await readFileAsText(file);

          pushMessage({
            role: "user",
            text: `Файл: ${file.name}\n\n${text.slice(0, 3000)}`,
            fileName: file.name,
          });

          setTyping(true);

          const answer = normalizeReply(
            brain.replyFile({
              kind: "text",
              name: file.name,
              size: file.size,
              mime: file.type,
              preview: text.slice(0, 500),
            })
          );

          pushMessage({ role: "ai", text: answer.text });
        } else {
          pushMessage({
            role: "user",
            text: `Файл: ${file.name}`,
            fileName: file.name,
          });

          const answer = normalizeReply(
            brain.replyFile({
              kind: "other",
              name: file.name,
              size: file.size,
              mime: file.type || "file",
            })
          );

          pushMessage({ role: "ai", text: answer.text });
        }
      } catch (error) {
        pushMessage({
          role: "ai",
          text: `Не удалось обработать файл ${file.name}: ${error.message}`,
        });
      } finally {
        setTyping(false);
      }
    }

    fileInput.value = "";
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    input.style.height = "auto";
    input.focus();

    void speak(text);
  });

  fileInput.addEventListener("change", () => {
    void handleFiles(fileInput.files);
  });

  clearBtn.addEventListener("click", resetActiveChat);
  newChatBtn.addEventListener("click", createChat);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
  });

  log.addEventListener("dragover", (event) => {
    event.preventDefault();
    log.classList.add("drop");
  });

  log.addEventListener("dragleave", () => {
    log.classList.remove("drop");
  });

  log.addEventListener("drop", (event) => {
    event.preventDefault();
    log.classList.remove("drop");

    if (event.dataTransfer?.files?.length) {
      void handleFiles(event.dataTransfer.files);
    }
  });

  loadStore();

  const chat = activeChat();
  brain = createPupikBrain(chat.brain);

  if (!chat.messages.length) {
    chat.messages.push({ role: "ai", text: brain.greeting() });
  }

  renderMessages(chat.messages);
  renderChatList();
  saveStore();
  setTyping(false);
  input.focus();
}
