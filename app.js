
/* =========================================================
   PUPIK AI — app.js
   Локальная языковая модель через WebLLM.
   Без API-ключей и собственного AI-сервера.
   ========================================================= */

const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const STORAGE_KEY = "pupik-ai-chats-v5";
const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `
Ты — Pupik AI, дружелюбный искусственный интеллект.
Отвечай на языке пользователя.
Отвечай понятно, полезно и по существу.
Для программирования предоставляй рабочий код и объясняй его.
Если не знаешь ответа, честно скажи об этом.
Не утверждай, что у тебя есть доступ к интернету, если его нет.
Ты работаешь на локальной языковой модели в браузере.
Ты не можешь видеть содержимое изображений, если оно не передано
модели специальным способом.
Не выдумывай результаты выполнения кода или действий с файлами.
`;

const $ = (id) => document.getElementById(id);

const log = $("log");
const composer = $("composer");
const input = $("input");
const fileInput = $("file");
const clearButton = $("clear-chat");
const newChatButton = $("new-chat");
const chatList = $("chat-list");
const status = $("status");

let engine = null;
let enginePromise = null;
let isGenerating = false;
let activeChatId = null;
let chats = loadChats();

/* ===================== ХРАНЕНИЕ ===================== */

function loadChats() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

        if (Array.isArray(saved) && saved.length) {
            return saved.map((chat, index) => ({
                id: chat.id || `chat-${Date.now()}-${index}`,
                title: chat.title || "Новый чат",
                messages: Array.isArray(chat.messages)
                    ? chat.messages.map((message) => ({
                        role: message.role === "ai"
                            ? "ai"
                            : message.role === "assistant"
                                ? "ai"
                                : "user",
                        text: String(message.text || ""),
                        image: message.image || null,
                        fileName: message.fileName || null
                    }))
                    : [],
                updatedAt: chat.updatedAt || Date.now()
            }));
        }
    } catch (error) {
        console.warn("Не удалось прочитать историю:", error);
    }

    return [{
        id: `chat-${Date.now()}`,
        title: "Новый чат",
        messages: [],
        updatedAt: Date.now()
    }];
}

function saveChats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    } catch (error) {
        console.error("Не удалось сохранить чаты:", error);
        setStatus("Не удалось сохранить историю чатов.");
    }
}

function getActiveChat() {
    return chats.find((chat) => chat.id === activeChatId) || null;
}

function ensureActiveChat() {
    let chat = getActiveChat();

    if (!chat) {
        chat = {
            id: `chat-${Date.now()}`,
            title: "Новый чат",
            messages: [],
            updatedAt: Date.now()
        };

        chats.unshift(chat);
        activeChatId = chat.id;
    }

    return chat;
}

function createChat() {
    const chat = {
        id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: "Новый чат",
        messages: [],
        updatedAt: Date.now()
    };

    chats.unshift(chat);
    activeChatId = chat.id;

    saveChats();
    renderMessages();
    renderChatList();
    setStatus(engine ? "Модель готова" : "Модель ещё не загружена");

    if (input) input.focus();
}

function switchChat(id) {
    if (!chats.some((chat) => chat.id === id)) return;

    activeChatId = id;
    renderMessages();
    renderChatList();
}

function resetActiveChat() {
    const chat = ensureActiveChat();

    chat.messages = [];
    chat.title = "Новый чат";
    chat.updatedAt = Date.now();

    saveChats();
    renderMessages();
    renderChatList();
}

function deleteChat(id) {
    chats = chats.filter((chat) => chat.id !== id);

    if (!chats.length) {
        chats.push({
            id: `chat-${Date.now()}`,
            title: "Новый чат",
            messages: [],
            updatedAt: Date.now()
        });
    }

    if (activeChatId === id) {
        activeChatId = chats[0].id;
    }

    saveChats();
    renderMessages();
    renderChatList();
}

/* ===================== ИНТЕРФЕЙС ===================== */

function setStatus(message) {
    if (status) status.textContent = message;
}

function scrollToBottom() {
    if (log) log.scrollTop = log.scrollHeight;
}

function addBubble(role, text, options = {}) {
    if (!log) return null;

    const row = document.createElement("div");
    row.className = `row ${role}`;

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    const content = document.createElement("div");
    content.className = "bubble-text";
    content.textContent = text;

    bubble.appendChild(content);

    if (options.fileName) {
        const fileLabel = document.createElement("div");
        fileLabel.className = "bubble-file";
        fileLabel.textContent = `📄 ${options.fileName}`;
        bubble.appendChild(fileLabel);
    }

    if (options.image) {
        const image = document.createElement("img");
        image.className = "bubble-img";
        image.src = options.image;
        image.alt = "Загруженное изображение";
        image.style.maxWidth = "100%";
        image.style.maxHeight = "300px";
        image.style.objectFit = "contain";
        bubble.appendChild(image);
    }

    row.appendChild(bubble);
    log.appendChild(row);

    scrollToBottom();
    return row;
}

function renderMessages() {
    if (!log) return;

    log.replaceChildren();

    const chat = ensureActiveChat();

    for (const message of chat.messages) {
        addBubble(message.role, message.text, {
            image: message.image,
            fileName: message.fileName
        });
    }

    scrollToBottom();
}

function renderChatList() {
    if (!chatList) return;

    chatList.replaceChildren();

    for (const chat of chats) {
        const row = document.createElement("div");
        row.className = "chat-row";

        const openButton = document.createElement("button");
        openButton.type = "button";
        openButton.className = "chat-item";
        openButton.textContent = chat.title || "Новый чат";
        openButton.title = chat.title || "Новый чат";

        if (chat.id === activeChatId) {
            openButton.classList.add("active");
        }

        openButton.addEventListener("click", () => {
            switchChat(chat.id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "chat-del";
        deleteButton.textContent = "×";
        deleteButton.title = "Удалить чат";

        deleteButton.addEventListener("click", (event) => {
            event.stopPropagation();

            if (confirm("Удалить этот чат?")) {
                deleteChat(chat.id);
            }
        });

        row.append(openButton, deleteButton);
        chatList.appendChild(row);
    }
}

function pushMessage(message) {
    const chat = ensureActiveChat();

    const savedMessage = {
        role: message.role === "ai" ? "ai" : "user",
        text: String(message.text || ""),
        image: message.image || null,
        fileName: message.fileName || null
    };

    chat.messages.push(savedMessage);
    chat.updatedAt = Date.now();

    if (
        chat.title === "Новый чат" &&
        savedMessage.role === "user"
    ) {
        const title = savedMessage.text
            .replace(/\s+/g, " ")
            .trim();

        chat.title = title.length > 35
            ? `${title.slice(0, 35)}…`
            : title || "Новый чат";
    }

    saveChats();

    addBubble(savedMessage.role, savedMessage.text, {
        image: savedMessage.image,
        fileName: savedMessage.fileName
    });

    renderChatList();
}

/* ===================== ЗАГРУЗКА МОДЕЛИ ===================== */

async function loadModel() {
    if (engine) return engine;
    if (enginePromise) return enginePromise;

    enginePromise = (async () => {
        if (!("gpu" in navigator)) {
            throw new Error(
                "WebGPU недоступен в этом браузере. " +
                "Попробуй обновлённый Chrome или другой совместимый браузер."
            );
        }

        setStatus("Подключение WebLLM…");

        const webllm = await import(
            "https://esm.run/@mlc-ai/web-llm"
        );

        setStatus("Подготовка модели…");

        engine = await webllm.CreateMLCEngine(MODEL_ID, {
            initProgressCallback: (progress) => {
                if (progress && progress.text) {
                    setStatus(progress.text);
                }
            }
        });

        setStatus("Pupik AI готов к работе");
        return engine;
    })();

    try {
        return await enginePromise;
    } catch (error) {
        engine = null;
        enginePromise = null;
        throw error;
    }
}

/* ===================== КОНТЕКСТ ДИАЛОГА ===================== */

function makeModelMessages() {
    const chat = ensureActiveChat();

    const history = chat.messages
        .filter((message) => message.text.trim())
        .slice(-MAX_HISTORY)
        .map((message) => ({
            role: message.role === "ai" ? "assistant" : "user",
            content: message.text
        }));

    return [
        {
            role: "system",
            content: SYSTEM_PROMPT
        },
        ...history
    ];
}

/* ===================== ОТВЕТ ИИ ===================== */

async function askModel() {
    if (isGenerating) return;

    const chat = ensureActiveChat();
    const lastMessage = chat.messages[chat.messages.length - 1];

    if (!lastMessage || lastMessage.role !== "user") return;

    isGenerating = true;

    if (input) input.disabled = true;

    const sendButton = composer
        ? composer.querySelector('button[type="submit"], button:not([type])')
        : null;

    if (sendButton) sendButton.disabled = true;

    const loadingRow = addBubble("ai", "Загружаю модель…");

    try {
        const model = await loadModel();

        if (loadingRow) {
            loadingRow.remove();
        }

        const row = addBubble("ai", "Думаю…");
        const result = await model.chat.completions.create({
            messages: makeModelMessages(),
            temperature: 0.7,
            max_tokens: 700
        });

        const answer = result.choices?.[0]?.message?.content?.trim();

        if (!answer) {
            throw new Error("Модель вернула пустой ответ.");
        }

        if (row) row.remove();

        pushMessage({
            role: "ai",
            text: answer
        });

        setStatus("Pupik AI готов к работе");
    } catch (error) {
        console.error("Ошибка WebLLM:", error);

        if (loadingRow) loadingRow.remove();

        const existingError = log
            ? log.querySelector(".pupik-error")
            : null;

        if (existingError) existingError.remove();

        const row = addBubble(
            "ai",
            `Не удалось получить ответ.\n\n${error.message || error}`
        );

        if (row) row.classList.add("pupik-error");

        setStatus("Ошибка загрузки или генерации модели");
    } finally {
        isGenerating = false;

        if (input) {
            input.disabled = false;
            input.focus();
        }

        if (sendButton) sendButton.disabled = false;
    }
}

/* ===================== ОТПРАВКА СООБЩЕНИЯ ===================== */

async function sendMessage(text) {
    const message = String(text || "").trim();

    if (!message || isGenerating) return;

    pushMessage({
        role: "user",
        text: message
    });

    await askModel();
}

/* ===================== КОМАНДЫ АГЕНТА ===================== */

function isAgentFileCommand(text) {
    return (
        /^(покажи|список)\s+(файлы|файлов)$/i.test(text) ||
        /^list files$/i.test(text) ||
        /^(прочитай|открой|покажи код файла)\s+[\w .()-]+\.(js|mjs|cjs|html|css|json|md|txt|py|ts)$/i.test(text)
    );
}

async function handleAgentCommand(text) {
    if (!window.AgentMode ||
        typeof window.AgentMode.handleCommand !== "function") {
        return false;
    }

    try {
        const result = await window.AgentMode.handleCommand(text);

        if (typeof result === "string" && result.trim()) {
            pushMessage({
                role: "ai",
                text: result
            });
        }

        return result !== false;
    } catch (error) {
        console.error("Ошибка агента:", error);
        pushMessage({
            role: "ai",
            text: `Ошибка агента: ${error.message || error}`
        });
        return true;
    }
}

/* ===================== ФАЙЛЫ ===================== */

function isTextFile(file) {
    return (
        file.type.startsWith("text/") ||
        /\.(txt|md|js|mjs|cjs|html|css|json|py|ts|csv|xml|yaml|yml|log)$/i.test(file.name)
    );
}

async function handleFiles(fileList) {
    const files = Array.from(fileList || []);

    for (const file of files) {
        if (file.size > 2 * 1024 * 1024) {
            pushMessage({
                role: "user",
                text: `Файл "${file.name}" слишком большой. Максимальный размер — 2 МБ.`,
                fileName: file.name
            });
            continue;
        }

        if (isTextFile(file)) {
            try {
                const content = await file.text();

                pushMessage({
                    role: "user",
                    fileName: file.name,
                    text:
                        `Содержимое файла "${file.name}":\n\n` +
                        content.slice(0, 12000)
                });

                await askModel();
            } catch (error) {
                pushMessage({
                    role: "ai",
                    text: `Не удалось прочитать файл: ${error.message || error}`
                });
            }

            continue;
        }

        if (file.type.startsWith("image/")) {
            const imageUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            pushMessage({
                role: "user",
                fileName: file.name,
                image: imageUrl,
                text:
                    `Я загрузил изображение "${file.name}". ` +
                    "Обрати внимание: эта текстовая модель не умеет анализировать изображение напрямую."
            });

            continue;
        }

        pushMessage({
            role: "user",
            fileName: file.name,
            text: `Загружен файл "${file.name}", но этот формат не поддерживается для чтения.`
        });
    }

    if (fileInput) fileInput.value = "";
}

/* ===================== СОБЫТИЯ ===================== */

if (composer) {
    composer.addEventListener("submit", async (event) => {
        event.preventDefault();

        const text = input ? input.value.trim() : "";
        if (!text || isGenerating) return;

        if (input) input.value = "";

        if (isAgentFileCommand(text)) {
            const handled = await handleAgentCommand(text);

            if (handled) {
                pushMessage({
                    role: "user",
                    text
                });
                return;
            }
        }

        await sendMessage(text);
    });
}

if (newChatButton) {
    newChatButton.addEventListener("click", createChat);
}

if (clearButton) {
    clearButton.addEventListener("click", () => {
        if (confirm("Очистить сообщения в этом чате?")) {
            resetActiveChat();
        }
    });
}

if (fileInput) {
    fileInput.addEventListener("change", async () => {
        await handleFiles(fileInput.files);
    });
}

/* Перетаскивание файлов в окно чата */

if (log) {
    log.addEventListener("dragover", (event) => {
        event.preventDefault();
    });

    log.addEventListener("drop", async (event) => {
        event.preventDefault();

        if (event.dataTransfer?.files?.length) {
            await handleFiles(event.dataTransfer.files);
        }
    });
}

/* ===================== ЗАПУСК ===================== */

if (chats.length === 0) {
    chats = [{
        id: `chat-${Date.now()}`,
        title: "Новый чат",
        messages: [],
        updatedAt: Date.now()
    }];
}

activeChatId = chats[0].id;


saveChats();
renderMessages();
renderChatList();

// Автоматическая загрузка ИИ при открытии сайта
setStatus("Pupik AI запускается…");

loadModel()
    .then(() => {
        setStatus("Pupik AI готов к работе!");
    })
    .catch((error) => {
        console.error("Ошибка запуска Pupik AI:", error);
        setStatus("Не удалось запустить ИИ. Проверь Console.");
    });


