import { createPupikBrain } from "./brain.js?v=10";
import { generateImage } from "./generate.js?v=10";
import { runCriticAgents, formatCriticReport } from "./agent.js?v=10";

const STORE_KEY = "pupik-ai-chats-v5";

const log = document.getElementById("log");
const form = document.getElementById("composer");
const input = document.getElementById("input");
const fileInput = document.getElementById("file");
const clearBtn = document.getElementById("clear-chat");
const agentBtn = document.getElementById("agent-mode");
const newChatBtn = document.getElementById("new-chat");
const chatListEl = document.getElementById("chat-list");
const statusEl = document.getElementById("status");

let agentMode = localStorage.getItem("pupik-agent-mode") === "1";

let chats = [];
let activeId = "";
/** @type {ReturnType<typeof createPupikBrain>} */
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
      activeId = raw.activeId && chats.some((c) => c.id === raw.activeId) ? raw.activeId : chats[0].id;
      return;
    }
  } catch {
    /* ignore */
  }
  const id = uid();
  chats = [{ id, title: "Чат 1", messages: [], brain: null, updated: Date.now() }];
  activeId = id;
}

function saveStore() {
  const active = chats.find((c) => c.id === activeId);
  if (active && brain) active.brain = brain.snapshot();
  // картинки тяжёлые — храним последние без гигантских dataUrl если переполнение
  const pack = {
    activeId,
    chats: chats.map((c) => ({
      id: c.id,
      title: c.title,
      messages: c.messages.slice(-120).map((m) => {
        if (m.image && m.image.length > 180000) {
          return { ...m, image: "", text: (m.text || "") + "\n[картинка не сохранена — слишком большая]" };
        }
        return m;
      }),
      brain: c.id === activeId && brain ? brain.snapshot() : c.brain,
      updated: c.updated,
    })),
  };
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(pack));
  } catch {
    pack.chats.forEach((c) => {
      c.messages = c.messages.map((m) => (m.image ? { ...m, image: "" } : m));
    });
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(pack));
    } catch {
      /* ignore */
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

function fillBubble(bubble, m) {
  bubble.textContent = "";
  if (m.text) {
    const p = document.createElement("div");
    p.className = "bubble-text";
    p.textContent = m.text;
    bubble.appendChild(p);
  }
  if (m.image) {
    const img = document.createElement("img");
    img.className = "bubble-img";
    img.src = m.image;
    img.alt = m.alt || "image";
    img.addEventListener("load", scrollBottom);
    bubble.appendChild(img);
  }
  if (m.fileName && !m.image) {
    const f = document.createElement("div");
    f.className = "bubble-file";
    f.textContent = `📄 ${m.fileName}`;
    bubble.appendChild(f);
  }
}

function renderMessages(messages) {
  log.innerHTML = "";
  for (const m of messages) {
    const row = document.createElement("div");
    row.className = `row ${m.role}`;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    fillBubble(bubble, m);
    row.appendChild(bubble);
    log.appendChild(row);
  }
  scrollBottom();
}

function pushMessage(msg) {
  const chat = activeChat();
  chat.messages.push(msg);
  chat.updated = Date.now();
  if (
    msg.role === "user" &&
    chat.title.startsWith("Чат") &&
    chat.messages.filter((m) => m.role === "user").length === 1
  ) {
    const t = msg.text || msg.fileName || "Чат";
    chat.title = t.slice(0, 28) + (t.length > 28 ? "…" : "");
  }
  const row = document.createElement("div");
  row.className = `row ${msg.role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  fillBubble(bubble, msg);
  row.appendChild(bubble);
  log.appendChild(row);
  scrollBottom();
  renderChatList();
  saveStore();
}

function syncAgentBtn() {
  if (!agentBtn) return;
  agentBtn.setAttribute("aria-pressed", agentMode ? "true" : "false");
  agentBtn.classList.toggle("on", agentMode);
  agentBtn.textContent = agentMode ? "агент · on" : "агент";
}

function setTyping(on) {
  const lang = brain?.getLang?.() || "ru";
  if (on) {
    statusEl.textContent = agentMode
      ? lang === "en"
        ? "critics running…"
        : "критики работают…"
      : lang === "en"
        ? "Pupik is thinking…"
        : "Pupik думает…";
  } else {
    statusEl.textContent = lang === "en" ? "online" : "на связи";
  }
  statusEl.dataset.state = on ? "busy" : "idle";
}

function applyAgent(draft, userText) {
  if (!agentMode) return draft;
  const lang = brain.getLang() || "ru";
  const { final, reports, avg } = runCriticAgents(draft, userText, lang);
  const report = formatCriticReport(reports, avg, lang);
  return `${final}\n\n${report}`;
}

function wantsOneShotCritics(text) {
  return /запусти\s+критик|саб.?агент|режим\s+агент|critic\s+agent|run\s+critics|оценк\w*\s*\/\s*10|критик\w*\s+на/i.test(
    String(text || "")
  );
}

function renderChatList() {
  const sorted = [...chats].sort((a, b) => b.updated - a.updated);
  chatListEl.innerHTML = "";
  for (const c of sorted) {
    const row = document.createElement("div");
    row.className = "chat-row";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chat-item" + (c.id === activeId ? " on" : "");
    btn.textContent = c.title;
    btn.title = c.title;
    btn.addEventListener("click", () => switchChat(c.id));

    const del = document.createElement("button");
    del.type = "button";
    del.className = "chat-del";
    del.title = "Удалить чат";
    del.setAttribute("aria-label", "Удалить чат");
    del.textContent = "×";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteChat(c.id);
    });

    row.appendChild(btn);
    row.appendChild(del);
    chatListEl.appendChild(row);
  }
}

function deleteChat(id) {
  if (chats.length <= 1) {
    resetActiveChat();
    const only = activeChat();
    only.title = "Чат";
    renderChatList();
    saveStore();
    return;
  }
  const wasActive = id === activeId;
  chats = chats.filter((c) => c.id !== id);
  if (wasActive) {
    activeId = chats.sort((a, b) => b.updated - a.updated)[0].id;
    const chat = activeChat();
    brain = createPupikBrain(chat.brain);
    if (!chat.messages.length) {
      const hi = brain.greeting();
      chat.messages.push({ role: "ai", text: hi });
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
  renderMessages(chat.messages);
  if (!chat.messages.length) {
    const hi = brain.greeting();
    chat.messages.push({ role: "ai", text: hi });
    renderMessages(chat.messages);
  }
  renderChatList();
  saveStore();
  input.focus();
}

function createChat() {
  saveStore();
  const id = uid();
  const n = chats.length + 1;
  chats.unshift({ id, title: `Чат ${n}`, messages: [], brain: null, updated: Date.now() });
  activeId = id;
  brain = createPupikBrain();
  const hi = brain.greeting();
  chats[0].messages.push({ role: "ai", text: hi });
  renderMessages(chats[0].messages);
  renderChatList();
  saveStore();
  input.focus();
}

function resetActiveChat() {
  const chat = activeChat();
  const msg = brain.resetConversation();
  chat.messages = [{ role: "ai", text: msg }];
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
    const m = chat.messages[i];
    if (m.role === "user" && m.image) return m.image;
  }
  return "";
}

async function speak(userText) {
  pushMessage({ role: "user", text: userText });
  setTyping(true);
  const oneShot = wantsOneShotCritics(userText);
  if (oneShot && !agentMode) {
    agentMode = true;
    localStorage.setItem("pupik-agent-mode", "1");
    syncAgentBtn();
  }
  const delay = 380 + Math.min(1100, userText.length * 12) + (agentMode ? 420 : 0);
  await new Promise((r) => setTimeout(r, delay));
  const answer = normalizeReply(brain.reply(userText));
  if (answer.type === "image") {
    await new Promise((r) => setTimeout(r, 280));
    const photo = answer.usePhoto ? lastUserPhoto() : "";
    if (answer.usePhoto && !photo) {
      pushMessage({
        role: "ai",
        text:
          brain.getLang() === "en"
            ? "Send your photo with 📎 first, then say “make me with Ronaldo”."
            : "Сначала прикрепи своё фото через 📎, потом снова напиши «сделай меня с роналду».",
      });
      setTyping(false);
      return;
    }
    const img = await generateImage(answer.prompt || userText, {
      photoDataUrl: photo || undefined,
    });
    let caption = answer.text;
    if (agentMode) caption = applyAgent(caption, userText);
    pushMessage({
      role: "ai",
      text: caption,
      image: img.dataUrl,
      alt: answer.prompt || "generated",
    });
  } else {
    const text = applyAgent(answer.text, userText);
    pushMessage({ role: "ai", text });
  }
  if (oneShot) {
    agentMode = false;
    localStorage.setItem("pupik-agent-mode", "0");
    syncAgentBtn();
  }
  setTyping(false);
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = reject;
    r.readAsText(file);
  });
}

async function handleFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  for (const file of files) {
    const isImage = file.type.startsWith("image/");
    const isText =
      file.type.startsWith("text/") ||
      /\.(txt|md|json|csv|js|ts|py|html|css|log|svg)$/i.test(file.name);

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
      await new Promise((r) => setTimeout(r, 350));
      const answer = normalizeReply(
        brain.replyFile({ kind: "image", name: file.name, size: file.size, mime: file.type })
      );
      pushMessage({ role: "ai", text: answer.text });
      setTyping(false);
    } else if (isText) {
      const text = await readFileAsText(file);
      pushMessage({
        role: "user",
        text: `Файл: ${file.name}`,
        fileName: file.name,
      });
      setTyping(true);
      await new Promise((r) => setTimeout(r, 350));
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
      setTyping(false);
    } else {
      pushMessage({
        role: "user",
        text: `Файл: ${file.name}`,
        fileName: file.name,
      });
      setTyping(true);
      await new Promise((r) => setTimeout(r, 350));
      const answer = normalizeReply(
        brain.replyFile({ kind: "other", name: file.name, size: file.size, mime: file.type || "file" })
      );
      pushMessage({ role: "ai", text: answer.text });
      setTyping(false);
    }
  }
  fileInput.value = "";
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  input.style.height = "auto";
  input.focus();
  speak(text);
});

fileInput.addEventListener("change", () => handleFiles(fileInput.files));

clearBtn.addEventListener("click", resetActiveChat);
newChatBtn.addEventListener("click", createChat);
if (agentBtn) {
  agentBtn.addEventListener("click", () => {
    agentMode = !agentMode;
    localStorage.setItem("pupik-agent-mode", agentMode ? "1" : "0");
    syncAgentBtn();
    const lang = brain?.getLang?.() || "ru";
    pushMessage({
      role: "ai",
      text: agentMode
        ? lang === "en"
          ? "Agent mode ON — each reply goes through 3 critic sub-agents (/10)."
          : "Режим агента ВКЛ — каждый ответ проходит 3 саб-агента-критика (/10)."
        : lang === "en"
          ? "Agent mode OFF."
          : "Режим агента ВЫКЛ.",
    });
  });
}

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
});

// drag & drop на окно чата
log.addEventListener("dragover", (e) => {
  e.preventDefault();
  log.classList.add("drop");
});
log.addEventListener("dragleave", () => log.classList.remove("drop"));
log.addEventListener("drop", (e) => {
  e.preventDefault();
  log.classList.remove("drop");
  if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
});

loadStore();
const chat = activeChat();
brain = createPupikBrain(chat.brain);
if (!chat.messages.length) {
  const hi = brain.greeting();
  chat.messages.push({ role: "ai", text: hi });
}
renderMessages(chat.messages);
renderChatList();
saveStore();
syncAgentBtn();
setTyping(false);
input.focus();
