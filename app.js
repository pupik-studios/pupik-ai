
const STORE_KEY = "pupik-ai-chats-v5";
const MODEL_ID = "Qwen2-1.5B-Instruct-q4f16_1-MLC";

const log = document.getElementById("log");
const form = document.getElementById("composer");
const input = document.getElementById("input");
const fileInput = document.getElementById("file");
const clearBtn = document.getElementById("clear-chat");
const newChatBtn = document.getElementById("new-chat");
const chatListEl = document.getElementById("chat-list");
const statusEl = document.getElementById("status");

if (
  !log || !form || !input || !fileInput ||
  !clearBtn || !newChatBtn || !chatListEl || !statusEl
) {
  console.error("Pupik AI: проверь ID элементов в index.html.");
} else {
  let chats = [];
  let activeId = "";
  let engine = null;
  let enginePromise = null;
  let busy = false;

  function uid() {
    return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function activeChat() {
    return chats.find(c => c.id === activeId);
  }

  function loadStore() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");

      if (raw && Array.isArray(raw.chats) && raw.chats.length) {
        chats = raw.chats.map(c => ({
          id: c.id || uid(),
          title: c.title || "Чат",
          messages: Array.isArray(c.messages) ? c.messages : [],
          brain: c.brain || null,
          updated: c.updated || Date.now()
        }));

        activeId = chats.some(c => c.id === raw.activeId)
          ? raw.activeId
          : chats[0].id;
        return;
      }
    } catch (error) {
      console.warn("История не загружена:", error);
    }

    activeId = uid();
    chats = [{
      id: activeId,
      title: "Чат 1",
      messages: [{
        role: "ai",
        text: "Привет! Я Pupik AI. Нажми на поле ввода и задай вопрос."
      }],
      brain: null,
      updated: Date.now()
    }];
  }

  function saveStore() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        activeId,
        chats: chats.map(c => ({
          ...c,
          messages: c.messages.slice(-80).map(m => {
            // Не сохраняем большие изображения в localStorage.
            if (m.image && m.image.length > 100000) {
              return {
                ...m,
                image: "",
                text: (m.text || "") + "\n[Изображение не сохранено]"
              };
            }
            return m;
          })
        }))
      }));
    } catch (error) {
      console.warn("Не удалось сохранить историю:", error);
    }
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
      file.textContent = "📄 " + message.fileName;
      bubble.appendChild(file);
    }
  }

  function renderMessages(messages) {
    log.innerHTML = "";

    for (const message of messages) {
      const row = document.createElement("div");
      row.className = "row " + message.role;

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
      chat.messages.filter(m => m.role === "user").length === 1
    ) {
      const title = message.text || message.fileName || "Чат";
      chat.title = title.slice(0, 28) + (title.length > 28 ? "…" : "");
    }

    const row = document.createElement("div");
    row.className = "row " + message.role;

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    fillBubble(bubble, message);

    row.appendChild(bubble);
    log.appendChild(row);

    renderChatList();
    saveStore();
    scrollBottom();
  }

  function setStatus(text, state = "idle") {
    statusEl.textContent = text;
    statusEl.dataset.state = state;
  }

  function renderChatList() {
    chatListEl.innerHTML = "";

    [...chats]
      .sort((a, b) => b.updated - a.updated)
      .forEach(chat => {
        const row = document.createElement("div");
        row.className = "chat-row";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "chat-item" +
          (chat.id === activeId ? " on" : "");
        button.textContent = chat.title;
        button.title = chat.title;
        button.addEventListener("click", () => switchChat(chat.id));

        const del = document.createElement("button");
        del.type = "button";
        del.className = "chat-del";
        del.textContent = "×";
        del.title = "Удалить чат";
        del.setAttribute("aria-label", "Удалить чат");

        del.addEventListener("click", event => {
          event.stopPropagation();
          deleteChat(chat.id);
        });

        row.append(button, del);
        chatListEl.appendChild(row);
      });
  }

  function switchChat(id) {
    if (id === activeId) return;

    activeId = id;
    renderMessages(activeChat().messages);
    renderChatList();
    saveStore();
  }

  function createChat() {
    const id = uid();

    chats.unshift({
      id,
      title: "Чат " + (chats.length + 1),
      messages: [{
        role: "ai",
        text: "Новый диалог! О чём поговорим?"
      }],
      brain: null,
      updated: Date.now()
    });

    activeId = id;
    renderMessages(activeChat().messages);
    renderChatList();
    saveStore();
    input.focus();
  }

  function deleteChat(id) {
    if (chats.length === 1) {
      const chat = activeChat();
      chat.title = "Чат";
      chat.messages = [{
        role: "ai",
        text: "Чат очищен. Чем могу помочь?"
      }];
      chat.updated = Date.now();
    } else {
      chats = chats.filter(c => c.id !== id);

      if (activeId === id) {
        activeId = [...chats].sort((a, b) => b.updated - a.updated)[0].id;
      }
    }

    renderMessages(activeChat().messages);
    renderChatList();
    saveStore();
  }

  function resetActiveChat() {
    const chat = activeChat();
    if (!chat) return;

    chat.messages = [{
      role: "ai",
      text: "Чат очищен. Задай новый вопрос!"
    }];
    chat.title = "Чат";
    chat.updated = Date.now();

    renderMessages(chat.messages);
    renderChatList();
    saveStore();
  }

  // WebLLM загружает модель непосредственно в браузер.
  async function ensureEngine() {
    if (engine) return engine;
    if (enginePromise) return enginePromise;

    enginePromise = (async () => {
      if (!("gpu" in navigator)) {
        throw new Error(
          "WebGPU не поддерживается этим браузером. " +
          "Попробуй обновить Chrome или Safari."
        );
      }

      setStatus("Загрузка ИИ…", "busy");

      const webllm = await import(
        "https://esm.run/@mlc-ai/web-llm"
      );

      const createdEngine = await webllm.CreateMLCEngine(
        MODEL_ID,
        {
          initProgressCallback: progress => {
            const text = progress.text || "Подготовка модели…";
            setStatus(text, "busy");
          }
        }
      );

      engine = createdEngine;
      setStatus("Локальный ИИ готов", "idle");
      return engine;
    })();

    try {
      return await enginePromise;
    } catch (error) {
      enginePromise = null;
      engine = null;
      setStatus("Ошибка загрузки ИИ", "error");
      throw error;
    }
  }

  function makeModelMessages() {
    const chat = activeChat();

    const history = chat.messages
      .filter(m => m.role === "user" || m.role === "ai" ||
                   m.role === "assistant")
      .slice(-20)
      .map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: String(m.text || "").slice(0, 5000)
      }))
      .filter(m => m.content.trim());

    return [
      {
        role: "system",
        content:
          "Ты Pupik AI, полезный ИИ-помощник. " +
          "Отвечай на языке пользователя, обычно по-русски. " +
          "Отвечай осмысленно, понятно и по существу. " +
          "Учитывай предыдущие сообщения. Не придумывай факты, " +
          "если не знаешь ответ — честно скажи об этом. " +
          "Ты работаешь локально и не имеешь доступа к интернету. " +
          "Ты текстовая модель и не можешь создавать изображения."
      },
      ...history
    ];
  }

  function isAgentFileCommand(text) {
    const command = text.trim();

    return (
      /^(покажи|список)\s+(файлы|файлов)$/i.test(command) ||
      /^list files$/i.test(command) ||
      /^(прочитай|открой|покажи код файла)\s+[\w .()-]+\.(js|mjs|cjs|html|css|json|md|txt|py|ts)$/i.test(command)
    );
  }

  async function askModel() {
    const currentEngine = await ensureEngine();
    const messages = makeModelMessages();

    setStatus("Pupik думает…", "busy");

    const result = await currentEngine.chat.completions.create({
      messages,
      temperature: 0.7,
      max_tokens: 700
    });

    const answer = result.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error("Модель не вернула ответ.");
    }

    pushMessage({ role: "ai", text: answer });
    setStatus("Локальный ИИ готов", "idle");
  }

  async function speak(text) {
    if (busy) return;
    busy = true;

    pushMessage({ role: "user", text });

    try {
      // Существующий агент файлов остаётся отдельным режимом.
      if (
        window.AgentMode?.isEnabled?.() &&
        isAgentFileCommand(text)
      ) {
        setStatus("Агент обрабатывает команду…", "busy");
        const handled = await window.AgentMode.handleCommand(text);

        if (!handled) {
          pushMessage({
            role: "ai",
            text: "Не удалось обработать команду агента."
          });
        }
        return;
      }

      await askModel();
    } catch (error) {
      console.error("Pupik AI:", error);

      pushMessage({
        role: "ai",
        text:
          "Не удалось запустить локальный ИИ.\n\n" +
          (error?.message || String(error)) +
          "\n\nПроверь подключение к интернету для первой загрузки " +
          "библиотеки и модели, поддержку WebGPU и свободную память."
      });
    } finally {
      busy = false;
      setStatus(
        engine ? "Локальный ИИ готов" : "ИИ ещё не загружен",
        "idle"
      );
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

    for (const file of files) {
      try {
        if (file.type.startsWith("image/")) {
          const dataUrl = await readFileAsDataURL(file);

          pushMessage({
            role: "user",
            text: "Прикреплено изображение: " + file.name,
            image: dataUrl,
            fileName: file.name,
            alt: file.name
          });

          pushMessage({
            role: "ai",
            text:
              "Я сохранил изображение в переписке, но выбранная " +
              "модель текстовая и не умеет анализировать картинки. " +
              "Можешь задать вопрос текстом."
          });
        } else if (
          file.type.startsWith("text/") ||
          /\.(txt|md|json|csv|js|ts|py|html|css|log|svg|mjs|cjs)$/i.test(file.name)
        ) {
          const text = await readFileAsText(file);

          pushMessage({
            role: "user",
            text: "Файл: " + file.name + "\n\n" + text.slice(0, 5000),
            fileName: file.name
          });

          await askModel();
        } else {
          pushMessage({
            role: "user",
            text: "Прикреплён файл: " + file.name,
            fileName: file.name
          });

          pushMessage({
            role: "ai",
            text: "Этот тип файла пока не поддерживается для чтения."
          });
        }
      } catch (error) {
        pushMessage({
          role: "ai",
          text: "Ошибка файла " + file.name + ": " + error.message
        });
      }
    }

    fileInput.value = "";
  }

  form.addEventListener("submit", event => {
    event.preventDefault();

    const text = input.value.trim();
    if (!text || busy) return;

    input.value = "";
    input.style.height = "auto";
    void speak(text);
  });

  fileInput.addEventListener("change", () => {
    void handleFiles(fileInput.files);
  });

  clearBtn.addEventListener("click", resetActiveChat);
  newChatBtn.addEventListener("click", createChat);

  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
  });

  log.addEventListener("dragover", event => {
    event.preventDefault();
    log.classList.add("drop");
  });

  log.addEventListener("dragleave", () => {
    log.classList.remove("drop");
  });

  log.addEventListener("drop", event => {
    event.preventDefault();
    log.classList.remove("drop");

    if (event.dataTransfer?.files?.length) {
      void handleFiles(event.dataTransfer.files);
    }
  });

  loadStore();
  renderMessages(activeChat().messages);
  renderChatList();
  saveStore();
  setStatus("ИИ ещё не загружен", "idle");
}
