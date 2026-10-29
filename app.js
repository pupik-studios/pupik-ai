
"use strict";

// ========================================
// PUPIK AI — настройки
// ========================================

const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const STORE_KEY = "pupik-ai-chats-v5";

let engine = null;
let modelPromise = null;
let isGenerating = false;

let chats = [];
let activeId = null;

const $ = (id) => document.getElementById(id);

// ========================================
// СТАРТОВЫЙ ЭКРАН
// ========================================

function createLoadingScreen() {
    if ($("pupik-loading-screen")) return;

    const style = document.createElement("style");

    style.textContent = `
        #pupik-loading-screen {
            position: fixed;
            inset: 0;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
            background:
                radial-gradient(ellipse at 50% 35%,
                #172554 0%, #090d1b 55%, #03050b 100%);
            color: #fff;
            font-family: Arial, sans-serif;
            transition: opacity .5s ease, visibility .5s ease;
        }

        #pupik-loading-screen.hidden {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }

        .pupik-loading-content {
            width: min(380px, 100%);
            text-align: center;
        }

        .pupik-logo {
            width: 82px;
            height: 82px;
            margin: 0 auto 24px;
            display: grid;
            place-items: center;
            border-radius: 26px;
            background: linear-gradient(135deg, #6366f1, #06b6d4);
            box-shadow: 0 0 55px #6366f155;
            font-size: 38px;
            font-weight: 800;
        }

        .pupik-title {
            margin: 0;
            font-size: 35px;
            font-weight: 800;
            letter-spacing: -1.5px;
        }

        .pupik-subtitle {
            margin: 12px 0 34px;
            color: #aab5d0;
            font-size: 14px;
            line-height: 1.6;
        }

        .pupik-progress-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
            font-size: 13px;
        }

        #pupik-loading-status {
            color: #c6cee2;
            text-align: left;
            overflow-wrap: anywhere;
        }

        #pupik-loading-percent {
            flex-shrink: 0;
            color: #67e8f9;
            font-size: 19px;
            font-weight: 800;
        }

        .pupik-progress-track {
            width: 100%;
            height: 8px;
            overflow: hidden;
            border-radius: 99px;
            background: #222b42;
        }

        #pupik-progress-fill {
            width: 0%;
            height: 100%;
            border-radius: inherit;
            background: linear-gradient(90deg, #6366f1, #22d3ee);
            box-shadow: 0 0 18px #22d3ee66;
            transition: width .25s ease;
        }

        .pupik-loading-note {
            margin-top: 20px;
            color: #8490aa;
            font-size: 12px;
            line-height: 1.7;
        }

        #pupik-loading-retry {
            display: none;
            margin-top: 22px;
            padding: 12px 22px;
            border: 0;
            border-radius: 12px;
            background: #6366f1;
            color: white;
            font-weight: bold;
            cursor: pointer;
        }

        .pupik-loading-dots span {
            display: inline-block;
            width: 6px;
            height: 6px;
            margin: 0 3px;
            border-radius: 50%;
            background: #67e8f9;
            animation: pupik-pulse 1s infinite alternate;
        }

        .pupik-loading-dots span:nth-child(2) {
            animation-delay: .2s;
        }

        .pupik-loading-dots span:nth-child(3) {
            animation-delay: .4s;
        }

        @keyframes pupik-pulse {
            from { opacity: .25; transform: scale(.8); }
            to { opacity: 1; transform: scale(1.2); }
        }
    `;

    document.head.appendChild(style);

    const screen = document.createElement("div");
    screen.id = "pupik-loading-screen";

    screen.innerHTML = `
        <div class="pupik-loading-content">
            <div class="pupik-logo">P</div>

            <h1 class="pupik-title">Pupik AI</h1>

            <p class="pupik-subtitle">
                Твой личный ИИ<br>
                Работает прямо в браузере
            </p>

            <div class="pupik-progress-row">
                <span id="pupik-loading-status">
                    Подготовка загрузки...
                </span>

                <span id="pupik-loading-percent">0%</span>
            </div>

            <div class="pupik-progress-track">
                <div id="pupik-progress-fill"></div>
            </div>

            <p class="pupik-loading-note">
                При первом запуске модель скачивается на устройство.
                Это может занять некоторое время.
                <br>
                <span class="pupik-loading-dots">
                    <span></span><span></span><span></span>
                </span>
            </p>

            <button id="pupik-loading-retry">
                Повторить загрузку
            </button>
        </div>
    `;

    document.body.appendChild(screen);

    $("pupik-loading-retry").addEventListener("click", () => {
        const retryButton = $("pupik-loading-retry");
        retryButton.style.display = "none";
        startModelLoading();
    });
}

function updateLoadingScreen(progress) {
    const percentElement = $("pupik-loading-percent");
    const fillElement = $("pupik-progress-fill");
    const statusElement = $("pupik-loading-status");

    if (!percentElement || !fillElement || !statusElement) return;

    if (progress && typeof progress.progress === "number") {
        const fraction = Math.max(
            0,
            Math.min(1, progress.progress)
        );

        const percent = Math.round(fraction * 100);

        percentElement.textContent = percent + "%";
        fillElement.style.width = percent + "%";
    }

    if (progress && progress.text) {
        statusElement.textContent = progress.text;
    }
}

function finishLoadingScreen() {
    const screen = $("pupik-loading-screen");

    if (!screen) return;

    screen.classList.add("hidden");

    setTimeout(() => {
        screen.remove();
    }, 600);
}

function showLoadingError(message) {
    const statusElement = $("pupik-loading-status");
    const retryButton = $("pupik-loading-retry");

    if (statusElement) {
        statusElement.textContent = message;
    }

    if (retryButton) {
        retryButton.style.display = "inline-block";
    }
}

// ========================================
// ЗАГРУЗКА ЛОКАЛЬНОЙ МОДЕЛИ
// ========================================

async function loadModel() {
    if (engine) return engine;
    if (modelPromise) return modelPromise;

    modelPromise = (async () => {
        updateLoadingScreen({
            text: "Проверка возможностей браузера..."
        });

        if (!("gpu" in navigator)) {
            throw new Error(
                "WebGPU недоступен. Попробуй обновить Chrome."
            );
        }

        updateLoadingScreen({
            text: "Подключение WebLLM..."
        });

        const webllm = await import(
            "https://esm.run/@mlc-ai/web-llm"
        );

        updateLoadingScreen({
            text: "Подготовка модели..."
        });

        engine = await webllm.CreateMLCEngine(MODEL_ID, {
            initProgressCallback: (progress) => {
                updateLoadingScreen(progress);

                if (progress && progress.text) {
                    setStatus(progress.text);
                }
            }
        });

        updateLoadingScreen({
            progress: 1,
            text: "ИИ готов к работе!"
        });

        return engine;
    })();

    try {
        return await modelPromise;
    } catch (error) {
        engine = null;
        modelPromise = null;
        throw error;
    }
}

async function startModelLoading() {
    setStatus("Pupik AI запускается...");

    try {
        await loadModel();

        setStatus("Pupik AI готов к работе!");

        updateLoadingScreen({
            progress: 1,
            text: "ИИ готов к работе!"
        });

        setTimeout(finishLoadingScreen, 700);
    } catch (error) {
        console.error("Ошибка загрузки модели:", error);

        const message = error && error.message
            ? error.message
            : String(error);

        showLoadingError(
            "Не удалось загрузить модель. " +
            "Проверь интернет и консоль браузера."
        );

        setStatus("Ошибка запуска ИИ: " + message);
    }
}

// ========================================
// СТАТУС
// ========================================

function setStatus(message) {
    const status = $("status");

    if (status) {
        status.textContent = message;
    }
}

// ========================================
// ЧАТЫ И СОХРАНЕНИЕ
// ========================================

function createId() {
    return Date.now().toString(36) +
        Math.random().toString(36).slice(2, 9);
}

function getActiveChat() {
    return chats.find((chat) => chat.id === activeId) || null;
}

function saveChats() {
    try {
        localStorage.setItem(
            STORE_KEY,
            JSON.stringify({
                chats,
                activeId
            })
        );
    } catch (error) {
        console.warn("Не удалось сохранить чаты:", error);
        setStatus("Не удалось сохранить чаты в браузере.");
    }
}

function loadChats() {
    try {
        const saved = localStorage.getItem(STORE_KEY);

        if (saved) {
            const data = JSON.parse(saved);

            if (Array.isArray(data)) {
                chats = data;
            } else {
                chats = Array.isArray(data.chats)
                    ? data.chats
                    : [];

                activeId = data.activeId || null;
            }
        }
    } catch (error) {
        console.warn("Не удалось прочитать чаты:", error);
        chats = [];
    }

    chats = chats.filter(
        (chat) => chat && typeof chat.id === "string"
    );

    for (const chat of chats) {
        if (!Array.isArray(chat.messages)) {
            chat.messages = [];
        }
    }

    if (!chats.some((chat) => chat.id === activeId)) {
        activeId = chats.length ? chats[0].id : null;
    }

    if (!activeId) {
        createChat();
    }
}

function createChat() {
    const chat = {
        id: createId(),
        title: "Новый чат",
        messages: [],
        createdAt: Date.now()
    };

    chats.unshift(chat);
    activeId = chat.id;

    saveChats();
    renderMessages();
    renderChatList();

    const input = $("input");
    if (input) input.focus();

    return chat;
}

function deleteChat(id) {
    chats = chats.filter((chat) => chat.id !== id);

    if (activeId === id) {
        activeId = chats.length ? chats[0].id : null;
    }

    if (!activeId) {
        createChat();
        return;
    }

    saveChats();
    renderMessages();
    renderChatList();
}

function clearActiveChat() {
    const chat = getActiveChat();
    if (!chat) return;

    chat.messages = [];
    chat.title = "Новый чат";

    saveChats();
    renderMessages();
    renderChatList();
}

function switchChat(id) {
    if (!chats.some((chat) => chat.id === id)) return;

    activeId = id;

    saveChats();
    renderMessages();
    renderChatList();
}

function updateChatTitle(chat) {
    if (!chat) return;

    const firstUserMessage = chat.messages.find(
        (message) => message.role === "user"
    );

    if (firstUserMessage) {
        chat.title = firstUserMessage.content
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 35) || "Новый чат";
    }
}

// ========================================
// ОТОБРАЖЕНИЕ СООБЩЕНИЙ
// ========================================

function renderMessages() {
    const log = $("log");
    if (!log) return;

    log.replaceChildren();

    const chat = getActiveChat();

    if (!chat || chat.messages.length === 0) {
        const welcome = document.createElement("div");
        welcome.className = "welcome-message";
        welcome.textContent =
            "Привет! Я Pupik AI. Напиши мне сообщение.";
        log.appendChild(welcome);
        return;
    }

    for (const message of chat.messages) {
        const element = document.createElement("div");

        element.className = message.role === "user"
            ? "message user-message"
            : "message ai-message";

        const text = document.createElement("div");
        text.className = "message-content";
        text.textContent = message.content || "";

        element.appendChild(text);

        if (message.fileName) {
            const fileLabel = document.createElement("div");
            fileLabel.className = "message-file";
            fileLabel.textContent = "Файл: " + message.fileName;
            element.appendChild(fileLabel);
        }

        log.appendChild(element);
    }

    log.scrollTop = log.scrollHeight;
}

function renderChatList() {
    const list = $("chat-list");
    if (!list) return;

    list.replaceChildren();

    for (const chat of chats) {
        const item = document.createElement("div");
        item.className = "chat-item";

        if (chat.id === activeId) {
            item.classList.add("active");
        }

        const title = document.createElement("button");
        title.type = "button";
        title.className = "chat-title";
        title.textContent = chat.title || "Новый чат";
        title.addEventListener("click", () => {
            switchChat(chat.id);
        });

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "delete-chat";
        remove.textContent = "×";
        remove.title = "Удалить чат";
        remove.addEventListener("click", (event) => {
            event.stopPropagation();
            deleteChat(chat.id);
        });

        item.append(title, remove);
        list.appendChild(item);
    }
}

function addMessage(role, content, extra = {}) {
    const chat = getActiveChat() || createChat();

    chat.messages.push({
        role,
        content: String(content ?? ""),
        ...extra,
        time: Date.now()
    });

    updateChatTitle(chat);
    saveChats();
    renderMessages();
    renderChatList();
}

// ========================================
// ФАЙЛЫ
// ========================================

async function readTextFile(file) {
    const maxSize = 2 * 1024 * 1024;

    if (file.size > maxSize) {
        throw new Error(
            "Файл слишком большой. Максимальный размер — 2 МБ."
        );
    }

    const textExtensions = [
        ".txt", ".md", ".csv", ".json",
        ".js", ".html", ".css", ".py",
        ".xml", ".yaml", ".yml", ".log"
    ];

    const name = file.name.toLowerCase();

    const isTextFile =
        file.type.startsWith("text/") ||
        file.type === "application/json" ||
        textExtensions.some((extension) => name.endsWith(extension));

    if (!isTextFile) {
        throw new Error(
            "Пока поддерживаются текстовые файлы, например TXT, JS, HTML, CSS и JSON."
        );
    }

    return await file.text();
}

function getSelectedFile() {
    const fileInput = $("file");

    if (!fileInput || !fileInput.files || !fileInput.files.length) {
        return null;
    }

    return fileInput.files[0];
}

// ========================================
// РЕЖИМ АГЕНТА
// ========================================

async function tryAgentCommand(text) {
    const agent = window.AgentMode;

    if (!agent || typeof agent.handleCommand !== "function") {
        return null;
    }

    try {
        const result = await agent.handleCommand(text);

        if (typeof result === "string" && result.trim()) {
            return result;
        }

        if (
            result &&
            typeof result === "object" &&
            typeof result.message === "string"
        ) {
            return result.message;
        }

        return null;
    } catch (error) {
        console.error("Ошибка режима агента:", error);

        return "Ошибка выполнения команды агента: " +
            (error.message || String(error));
    }
}

// ========================================
// ОТВЕТ ИИ
// ========================================

async function generateAnswer(userText, fileContext = "") {
    const activeEngine = await loadModel();

    const chat = getActiveChat();

    const history = chat
        ? chat.messages
            .filter((message) =>
                message.role === "user" ||
                message.role === "ai"
            )
            .slice(-12)
            .map((message) => ({
                role: message.role === "ai" ? "assistant" : "user",
                content: message.content
            }))
        : [];

    const prompt = fileContext
        ? userText +
          "\n\nСодержимое прикреплённого текстового файла:\n" +
          fileContext
        : userText;

    const messages = [
        {
            role: "system",
            content:
                "Ты Pupik AI — полезный, дружелюбный ИИ-помощник. " +
                "Отвечай на языке пользователя. " +
                "Объясняй понятно и по делу. " +
                "Не утверждай, что выполнил действие, если оно не выполнено."
        },
        ...history,
        {
            role: "user",
            content: prompt
        }
    ];

    const result = await activeEngine.chat.completions.create({
        messages,
        temperature: 0.7,
        max_tokens: 700
    });

    return result.choices?.[0]?.message?.content?.trim()
        || "Не получилось создать ответ. Попробуй ещё раз.";
}

// ========================================
// ОТПРАВКА СООБЩЕНИЯ
// ========================================

async function sendMessage() {
    if (isGenerating) return;

    const input = $("input");
    if (!input) return;

    const userText = input.value.trim();
    const file = getSelectedFile();

    if (!userText && !file) return;

    isGenerating = true;

    const composer = $("composer");
    const sendButton = composer
        ? composer.querySelector(
            'button[type="submit"], button:not([type])'
        )
        : null;

    if (sendButton) sendButton.disabled = true;

    input.value = "";

    let fileContext = "";
    let fileName = "";

    try {
        if (file) {
            fileName = file.name;
            setStatus("Читаю файл...");

            fileContext = await readTextFile(file);
        }

        const visibleText = userText || "Посмотри прикреплённый файл.";

        addMessage("user", visibleText, {
            fileName: fileName || undefined
        });

        if (fileContext) {
            // Сохраняем содержимое файла только для текущего запроса.
            // Оно не отправляется на внешний сервер.
        }

        if ($("file")) $("file").value = "";

        setStatus("Pupik AI думает...");

        // Сначала проверяем, доступна ли команда режима агента.
        const agentResult = await tryAgentCommand(userText);

        if (agentResult !== null) {
            addMessage("ai", agentResult);
            setStatus("Готово");
            return;
        }

        const answer = await generateAnswer(
            visibleText,
            fileContext
        );

        addMessage("ai", answer);
        setStatus("Готово");
    } catch (error) {
        console.error("Ошибка:", error);

        const message = error && error.message
            ? error.message
            : String(error);

        addMessage(
            "ai",
            "Не удалось выполнить запрос.\n\n" + message
        );

        setStatus("Возникла ошибка. Проверь Console.");
    } finally {
        isGenerating = false;

        if (sendButton) sendButton.disabled = false;

        if ($("input")) $("input").focus();
    }
}

// ========================================
// ПЕРЕТАСКИВАНИЕ ФАЙЛОВ
// ========================================

function setupDragAndDrop() {
    const log = $("log");
    if (!log) return;

    log.addEventListener("dragover", (event) => {
        event.preventDefault();
        log.classList.add("drag-over");
    });

    log.addEventListener("dragleave", () => {
        log.classList.remove("drag-over");
    });

    log.addEventListener("drop", (event) => {
        event.preventDefault();
        log.classList.remove("drag-over");

        const files = event.dataTransfer?.files;

        if (files && files.length && $("file")) {
            const transfer = new DataTransfer();

            transfer.items.add(files[0]);
            $("file").files = transfer.files;

            setStatus("Прикреплён файл: " + files[0].name);
        }
    });
}

// ========================================
// ПОДКЛЮЧЕНИЕ КНОПОК
// ========================================

function setupEvents() {
    const composer = $("composer");

    if (composer) {
        composer.addEventListener("submit", (event) => {
            event.preventDefault();
            sendMessage();
        });
    }

    const input = $("input");

    if (input) {
        input.addEventListener("keydown", (event) => {
            if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.isComposing
            ) {
                event.preventDefault();
                sendMessage();
            }
        });
    }

    const newChatButton = $("new-chat");

    if (newChatButton) {
        newChatButton.addEventListener("click", () => {
            createChat();
        });
    }

    const clearButton = $("clear-chat");

    if (clearButton) {
        clearButton.addEventListener("click", () => {
            clearActiveChat();
        });
    }

    const fileInput = $("file");

    if (fileInput) {
        fileInput.addEventListener("change", () => {
            const file = getSelectedFile();

            if (file) {
                setStatus("Прикреплён файл: " + file.name);
            }
        });
    }

    setupDragAndDrop();
}

// ========================================
// ЗАПУСК ПРИ ОТКРЫТИИ СТРАНИЦЫ
// ========================================

function initPupikAI() {
    createLoadingScreen();

    loadChats();
    renderMessages();
    renderChatList();
    setupEvents();

    startModelLoading();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initPupikAI,
        { once: true }
    );
} else {
    initPupikAI();
}

