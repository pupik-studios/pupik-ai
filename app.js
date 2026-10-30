
import { generateImage, wantsImage, extractImagePrompt, photoSubjects } from "./generate.js?v=31";
import { trySolve } from "./knowledge.js?v=19";

const NAME_KEY = "pupik_user_name";

let userName = localStorage.getItem(NAME_KEY) || "";

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

let generating = false;
let chatHistory = [];
let currentChatId = null;
let chats = [];

try {
  const saved = JSON.parse(localStorage.getItem("pupik_chats") || "[]");

  if (Array.isArray(saved)) {
    chats = saved.filter(chat =>
      chat &&
      typeof chat.id === "string" &&
      Array.isArray(chat.messages)
    );
  }
} catch (error) {
  console.warn("Ошибка истории:", error);
}

// Пользователь всегда видит только название агента
function setStatus(online = false) {
  statusText.textContent = online ? "Pupik AI" : "Загружаюсь";
  statusDot.classList.toggle("online", online);
}

function saveChats() {
  try {
    localStorage.setItem("pupik_chats", JSON.stringify(chats));
  } catch (error) {
    console.warn("Ошибка сохранения:", error);
  }
}

function renderHistory() {
  historyElement.innerHTML = "";

  chats.forEach(chat => {
    const row = document.createElement("div");
    row.className = "history-row";

    const button = document.createElement("button");
    button.className = "history-item";
    button.textContent = chat.title || "Новый чат";

    if (chat.id === currentChatId) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => openChat(chat.id));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "history-delete";
    remove.title = "Удалить чат";
    remove.setAttribute("aria-label", "Удалить чат");
    remove.textContent = "×";
    remove.addEventListener("click", () => deleteChat(chat.id));

    row.appendChild(button);
    row.appendChild(remove);
    historyElement.appendChild(row);
  });
}

function clearCurrentChat() {
  if (generating) return;
  if (!currentChatId) {
    createChat();
    return;
  }

  const chat = chats.find(item => item.id === currentChatId);
  chatHistory = [];
  if (chat) {
    chat.messages = [];
    chat.title = "Новый чат";
  }

  saveChats();
  renderHistory();
  renderMessages();
  titleElement.textContent = "Новый диалог";
  input.focus();
}

function deleteChat(id) {
  if (generating) return;

  chats = chats.filter(item => item.id !== id);

  if (!chats.length) {
    currentChatId = null;
    chatHistory = [];
    saveChats();
    createChat();
    return;
  }

  if (currentChatId === id) {
    currentChatId = chats[0].id;
    chatHistory = [...chats[0].messages];
    titleElement.textContent = chats[0].title || "Новый диалог";
    renderMessages();
  }

  saveChats();
  renderHistory();
}

function deleteAllChats() {
  if (generating) return;
  chats = [];
  currentChatId = null;
  chatHistory = [];
  saveChats();
  createChat();
}

function createChat() {
  if (generating) return;

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

function openChat(id) {
  if (generating) return;

  const chat = chats.find(item => item.id === id);
  if (!chat) return;

  currentChatId = id;
  chatHistory = [...chat.messages];

  titleElement.textContent = chat.title || "Новый диалог";

  renderMessages();
  renderHistory();
  sidebar.classList.remove("open");
}

function renderMessages() {
  messagesElement.innerHTML = "";

  // Начальный экран показывается только в пустом чате
  welcome.style.display = chatHistory.length ? "none" : "flex";

  chatHistory.forEach(message => {
    addMessageToScreen(message.role, message.content, message.image);
  });

  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function addMessageToScreen(role, content, image) {
  const message = document.createElement("div");
  message.className = "message " +
    (role === "user" ? "user-message" : "ai-message");

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user"
    ? (userName || "Я").trim().charAt(0).toUpperCase()
    : "P";

  const body = document.createElement("div");
  body.className = "message-body";

  const name = document.createElement("div");
  name.className = "message-name";
  name.textContent = role === "user" ? (userName || "Ты") : "Pupik AI";

  if (content) {
    const text = document.createElement("div");
    text.className = "message-text";
    text.textContent = content;
    body.appendChild(text);
  }

  if (image) {
    const picture = document.createElement("img");
    picture.className = "message-image";
    picture.alt = "фото";
    picture.referrerPolicy = "no-referrer";
    picture.src = image;
    body.appendChild(picture);
  }

  body.prepend(name);
  message.appendChild(avatar);
  message.appendChild(body);

  messagesElement.appendChild(message);
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function addTyping() {
  removeTyping();

  const typing = document.createElement("div");
  typing.className = "typing";
  typing.id = "typing";
  typing.innerHTML = "<span></span><span></span><span></span>";

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
  titleElement.textContent = chat.title;
}

const boot = document.getElementById("boot");
const bootStatus = document.getElementById("bootStatus");
const bootBar = document.getElementById("bootBar");
const register = document.getElementById("register");
const registerForm = document.getElementById("registerForm");
const nameInput = document.getElementById("nameInput");
const profileName = document.getElementById("profileName");
const profileIcon = document.getElementById("profileIcon");

function setBoot(_text, percent) {
  if (bootStatus) bootStatus.textContent = "Загружаюсь";
  if (bootBar && typeof percent === "number") {
    bootBar.style.width = `${Math.max(4, Math.min(100, percent))}%`;
  }
}

function startBootGame() {
  const canvas = document.getElementById("bootGame");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const keys = new Set();
  const player = { x: 150, y: h / 2, r: 14 };
  const keeper = { x: w - 58, y: h / 2, r: 14 };
  const ball = { x: 230, y: h / 2, vx: 0, vy: 0, r: 8 };
  let score = 0;
  let cool = 0;

  function resetBall() {
    ball.x = 230;
    ball.y = h / 2;
    ball.vx = 0;
    ball.vy = 0;
    player.x = 150;
    player.y = h / 2;
  }

  window.addEventListener("keydown", (event) => {
    if (boot?.hidden) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
      event.preventDefault();
    }
    keys.add(event.key.toLowerCase());
  });
  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });

  function down(name) {
    return keys.has(name);
  }

  function frame() {
    if (boot?.hidden) return;
    let mx = 0;
    let my = 0;
    if (down("arrowleft") || down("a")) mx -= 1;
    if (down("arrowright") || down("d")) mx += 1;
    if (down("arrowup") || down("w")) my -= 1;
    if (down("arrowdown") || down("s")) my += 1;
    const len = Math.hypot(mx, my) || 1;
    player.x = Math.min(w - 30, Math.max(24, player.x + (mx / len) * 3.4));
    player.y = Math.min(h - 24, Math.max(24, player.y + (my / len) * 3.4));

    const dx = ball.x - player.x;
    const dy = ball.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < player.r + ball.r + 4 && cool <= 0) {
      const kick = dist || 1;
      ball.vx = (dx / kick) * 7.2 + mx * 1.4;
      ball.vy = (dy / kick) * 7.2 + my * 1.4;
      cool = 8;
    }
    if (cool > 0) cool -= 1;

    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vx *= 0.985;
    ball.vy *= 0.985;
    if (ball.y < ball.r || ball.y > h - ball.r) ball.vy *= -1;
    ball.y = Math.min(h - ball.r, Math.max(ball.r, ball.y));
    if (ball.x < ball.r) {
      ball.x = ball.r;
      ball.vx *= -0.6;
    }

    const goalTop = h * 0.32;
    const goalBot = h * 0.68;
    keeper.y += Math.sign(ball.y - keeper.y) * 1.7;
    keeper.y = Math.min(goalBot - 8, Math.max(goalTop + 8, keeper.y));
    const kd = Math.hypot(ball.x - keeper.x, ball.y - keeper.y);
    if (kd < keeper.r + ball.r + 2) {
      ball.vx = -5.5;
      ball.vy = (ball.y - keeper.y) * 0.2;
    }

    if (ball.x > w - 16 && ball.y > goalTop && ball.y < goalBot) {
      score += 1;
      resetBall();
    } else if (ball.x > w - ball.r) {
      ball.x = w - ball.r;
      ball.vx *= -0.7;
    }

    ctx.fillStyle = "#147a3d";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#178a46";
    for (let i = 0; i < 8; i += 1) {
      if (i % 2 === 0) ctx.fillRect((w / 8) * i, 0, w / 8, h);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, w - 24, h - 24);
    ctx.beginPath();
    ctx.moveTo(w / 2, 12);
    ctx.lineTo(w / 2, h - 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 48, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(w - 70, goalTop, 58, goalBot - goalTop);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(w - 22, goalTop, 10, goalBot - goalTop);

    ctx.fillStyle = "#f5f7fb";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#2f6bff";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff4d4d";
    ctx.beginPath();
    ctx.arc(keeper.x, keeper.y, keeper.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "700 22px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(score), 22, 40);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function applyName() {
  const name = userName || "Pupik User";
  if (profileName) profileName.textContent = name;
  if (profileIcon) profileIcon.textContent = name.trim().charAt(0).toUpperCase() || "P";
}

function showApp() {
  if (boot) boot.hidden = true;
  if (register) register.hidden = true;
  applyName();
  setStatus(true);
  input.focus();
}

function afterBoot() {
  if (!userName) {
    if (boot) boot.hidden = true;
    if (register) {
      register.hidden = false;
      nameInput?.focus();
    }
    return;
  }
  showApp();
}

const NOTES_KEY = "pupik_notes";

function loadNotes() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTES_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function remember(note) {
  const notes = loadNotes().filter(item => item !== note);
  notes.unshift(note);
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes.slice(0, 12)));
}

function noteText() {
  const notes = loadNotes();
  return notes.length ? ` Помню: ${notes.join("; ")}.` : "";
}

function named(text) {
  return userName ? `${userName}, ${text}` : text.charAt(0).toUpperCase() + text.slice(1);
}

function previousUserText() {
  const users = chatHistory.filter(item => item.role === "user");
  return (users.length > 1 ? users[users.length - 2].content : "").toLowerCase().replace(/ё/g, "е");
}

function visualCodeAnswer(q) {
  const visual = /визуал|visual code|scratch|блочн/.test(q);
  const rejectsPython = /не на питон|не питон|без питона|не python/.test(q);
  if (!visual && !rejectsPython) return "";

  const prev = previousUserText();
  const topic = `${q} ${prev}`;
  if (/тренаж|русск|перевод|фраз/.test(topic) && /2|втор/.test(q)) {
    return named(`вот тренажёр слов страницей, без Python. Сохрани как words.html и открой в браузере.

\`\`\`html
<!DOCTYPE html>
<meta charset="utf-8">
<p id="ask"></p>
<input id="word">
<button id="ok">Проверить</button>
<script>
const pairs = [["привет", "hello"], ["спасибо", "thank you"], ["пожалуйста", "please"]];
let i = 0;
const ask = document.getElementById("ask");
function show() { ask.textContent = "Как по-английски: " + pairs[i][0]; }
show();
document.getElementById("ok").onclick = () => {
  const answer = document.getElementById("word").value.trim().toLowerCase();
  ask.textContent = answer === pairs[i][1] ? "Верно" : "Нет, это " + pairs[i][1];
  i = (i + 1) % pairs.length;
  setTimeout(show, 900);
};
</script>
\`\`\`

Файл можно править в Visual Studio Code.`);
  }

  return named(`без Python: это страница, её открывают в браузере и правят в Visual Studio Code. Сохрани как game.html.

\`\`\`html
<!DOCTYPE html>
<meta charset="utf-8">
<p id="log">Я загадал число от 1 до 20. Есть 5 попыток.</p>
<input id="guess" type="number">
<button id="ok">Проверить</button>
<script>
const secret = Math.floor(Math.random() * 20) + 1;
let left = 5;
document.getElementById("ok").onclick = () => {
  const guess = Number(document.getElementById("guess").value);
  const log = document.getElementById("log");
  left -= 1;
  if (guess === secret) log.textContent = "Угадал!";
  else if (!left) log.textContent = "Число было " + secret;
  else log.textContent = (guess < secret ? "Больше. " : "Меньше. ") + "Осталось " + left;
};
</script>
\`\`\`

Идея 2 — тренажёр слов, идея 3 — табло. Напиши номер.`);
}

function codeAnswer(q) {
  const game = /игр/.test(q) && /питон|python|наивн|програм|напиш|код/.test(q);
  if (game) {
    return named(`вот наивная игра на Python — угадай число от 1 до 20.

\`\`\`python
import random

secret = random.randint(1, 20)
print("Я загадал число от 1 до 20. Есть 5 попыток.")

for attempt in range(1, 6):
    guess = int(input(f"Попытка {attempt}: "))
    if guess == secret:
        print("Угадал!")
        break
    print("Больше." if guess < secret else "Меньше.")
else:
    print("Число было", secret)
\`\`\`

Сохрани как game.py и запусти: python3 game.py
Нужна другая игра — напиши какая.`);
  }

  const program = /програм|код|скрипт|питон|python|функци/.test(q) && /напиш|помог|сделай|создай|програм/.test(q);
  if (program) {
    return named(`начнём с маленькой программы. Напиши, что она должна делать. Пока каркас на Python:

\`\`\`python
def main():
    name = input("Как тебя зовут? ")
    print(f"Привет, {name}. Программа работает.")

if __name__ == "__main__":
    main()
\`\`\`

Запуск: python3 main.py`);
  }

  return "";
}

function explainAnswer(q) {
  if (!/объясн/.test(q)) return "";
  return named(`возьмём функцию. Это кнопка с именем: даёшь ей данные, она делает одно дело и отдаёт результат.

\`\`\`python
def удвоить(число):
    return число * 2

print(удвоить(7))  # 14
\`\`\`

Напиши, какую тему разобрать дальше: Python, русский или футбол.`);
}

function ideaAnswer(q) {
  if (!/иде|проект/.test(q)) return "";
  return named(`три идеи на один вечер:

1. Игра «угадай число»: программа загадывает число, ты угадываешь.
2. Тренажёр русских фраз: показывает слово, ты пишешь перевод.
3. Мини-табло: вводишь счёт, программа говорит, кто победил.

Напиши номер и как кодить: питон или визуальный код (страница для браузера).`);
}

function factAnswer(q) {
  if (!/факт|интересн|расскажи|поболта/.test(q)) return "";
  const lines = [
    "Криштиану Роналду родился 5 февраля 1985 года. Номер 7 он носил в «Манчестер Юнайтед», «Реале» и сборной.",
    "Python назвали не в честь змеи, а в честь шоу Monty Python.",
    "В русском ударение часто меняет смысл: замок и замок, мука и мука."
  ];
  if (loadNotes().some(note => /русск/.test(note))) {
    lines.push("Фраза для тренировки: «Я учусь говорить по-русски».");
  }
  return named("держи.\n\n" + lines.map((line, i) => `${i + 1}. ${line}`).join("\n"));
}

function localAnswer(question) {
  const q = question.toLowerCase().replace(/ё/g, "е");
  const name = userName || "";

  if (/учу русск|изучаю русск|учу язык/.test(q)) {
    remember("учит русский");
  }
  if (/люблю футбол|играю в футбол/.test(q)) {
    remember("любит футбол");
  }

  if (/кто создател|кто создал|кто автор|who created|who made/.test(q)) {
    return "Создатель: Владимиров Роберт Павлович.";
  }
  if (/гном/.test(q)) {
    return "Ты имел в виду Месси?";
  }
  if (/^(привет|здравств|хай|hello|hi)(\s|$)/.test(q)) {
    return `${name ? `Привет, ${name}` : "Привет"}. Я твой помощник: могу написать программу, рассказать факт, поучить русскому и нарисовать.${noteText()}`;
  }
  if (/как дела|как ты/.test(q)) {
    return `${name ? name + ", у" : "У"} меня всё в порядке. Чем помочь?${noteText()}`;
  }
  if (/учу русск|изучаю русск|русский язык|по-русски/.test(q)) {
    return `${name ? name + ", д" : "Д"}ержу это в голове. Фраза на сегодня: «Я учусь говорить по-русски». Слова: привет, спасибо, пожалуйста. Повтори их вслух, потом напиши своё предложение — поправлю.`;
  }
  if (/что умеешь|личный помощник|кто ты/.test(q)) {
    return `Я Pupik AI${name ? ", помощник " + name : ""}. Пишу код, разбираю задачу по шагам, учу русский и показываю фото.${noteText()}`;
  }
  if (/сколько/.test(q) && /кот/.test(q) && /пл[ао]нет|мир|земл/.test(q)) {
    return `${name ? name + ", т" : "Т"}очного числа нет: кошек никто не переписывает всех сразу. Домашних оценивают примерно в 600 миллионов, а вместе с бездомными — около миллиарда.`;
  }

  const visual = visualCodeAnswer(q);
  if (visual) return visual;

  const code = codeAnswer(q);
  if (code) return code;

  const explained = explainAnswer(q);
  if (explained) return explained;

  const idea = ideaAnswer(q);
  if (idea) return idea;

  const facts = factAnswer(q);
  if (facts) return facts;

  const solved = trySolve(question);
  if (solved?.answer && !/нарисуй/.test(q)) return solved.answer;

  return "";
}

function fallbackAnswer() {
  const name = userName || "";
  return `${name ? name + ", я" : "Я"} на связи. Могу написать программу, разобрать задачу, рассказать факт или нарисовать.`;
}

function drawingCaption(question) {
  const q = question.toLowerCase().replace(/ё/g, "е");
  if (/учу русск|изучаю русск/.test(q)) remember("учит русский");
  const labels = photoSubjects(question).map(item => item.label);
  const again = /друг|ещ[её]|another|different/.test(q);
  if (labels.length > 1 && /сбив|толк|подкат/.test(q)) {
    return `Вот фото: ${labels[0]} сбивает ${labels[1]}.`;
  }
  if (labels.length > 1) return `${again ? "Вот другие фото" : "Вот фото"}: ${labels.join(" и ")}.`;
  if (labels.length === 1) return again ? `Вот другое фото: ${labels[0]}.` : `Вот фото: ${labels[0]}.`;
  return "Вот фото.";
}

function imageFollowUp(question) {
  const q = question.toLowerCase().replace(/ё/g, "е");
  const pose = /лицом|спереди|анфас|в лицо|со спины|сзади/.test(q);
  if (wantsImage(question)) return "";
  if (!pose && !/(?:^|[^а-я])где(?:[^а-я]|$)|(?:^|[^а-я])нет(?:[^а-я]|$)|не вижу|потеря/.test(q)) return "";
  if (!pose && !photoSubjects(q).some(item => item.known)) return "";
  const last = [...chatHistory].reverse().find(item => item.role === "user" && wantsImage(item.content));
  if (!last) return pose ? "" : question;
  return `${last.content} ${question}`;
}

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
    let answer = "";
    let image = "";

    const follow = imageFollowUp(question);
    if (/гном/.test(question.toLowerCase().replace(/ё/g, "е"))) {
      answer = "Ты имел в виду Месси?";
    } else if (wantsImage(question) || follow) {
      const prompt = follow || extractImagePrompt(question);
      try {
        const drawn = await generateImage(prompt);
        image = drawn.dataUrl;
        const caption = drawingCaption(prompt);
        const pose = /лицом|спереди|анфас|в лицо/.test(question.toLowerCase());
        if (pose) {
          answer = caption.replace(/\.$/, " лицом вперёд.");
        } else if (follow) {
          const missing = photoSubjects(question)[0]?.label || "это";
          const titled = missing.charAt(0).toUpperCase() + missing.slice(1);
          answer = `${titled} тоже на фото. ${caption}`;
        } else {
          answer = caption;
        }
      } catch (error) {
        console.warn("Фото не найдено:", error);
        answer = error?.message && error.message !== "no photo"
          ? error.message
          : "Не нашёл фото по этим словам.";
      }
    } else {
      answer = localAnswer(question);
    }

    if (!answer && !image) answer = fallbackAnswer();

    removeTyping();

    chatHistory.push({
      role: "assistant",
      content: answer,
      image
    });

    addMessageToScreen("assistant", answer, image);
    saveCurrentChat();

  } catch (error) {
    removeTyping();
    console.error("Ошибка Pupik AI:", error);

    const errorMessage = localAnswer(question) || fallbackAnswer();
    chatHistory.push({
      role: "assistant",
      content: errorMessage
    });
    addMessageToScreen("assistant", errorMessage);
    saveCurrentChat();
  } finally {
    generating = false;
    sendButton.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const text = input.value.trim();
  if (!text || generating) return;

  input.value = "";
  input.style.height = "auto";

  sendMessage(text);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 160) + "px";
});

input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

newChatButton.addEventListener("click", createChat);
document.getElementById("clearChat").addEventListener("click", clearCurrentChat);
document.getElementById("deleteChats").addEventListener("click", deleteAllChats);

menuButton.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

document.querySelectorAll(".suggestion").forEach(button => {
  button.addEventListener("click", () => {
    const prompt = button.dataset.prompt;
    if (prompt) sendMessage(prompt);
  });
});

// При открытии сайта показываем начальный экран,
// а историю — в боковой панели.
renderHistory();

if (chats.length > 0) {
  currentChatId = null;
  chatHistory = [];
  renderMessages();
  titleElement.textContent = "Новый диалог";
} else {
  renderMessages();
}

setStatus(false);
applyName();

registerForm?.addEventListener("submit", event => {
  event.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  userName = name;
  localStorage.setItem(NAME_KEY, name);
  showApp();
});

startBootGame();
let bootPercent = 8;
const bootTimer = setInterval(() => {
  bootPercent = Math.min(100, bootPercent + 18);
  setBoot("Загружаюсь", bootPercent);
  if (bootPercent >= 100) clearInterval(bootTimer);
}, 200);
setTimeout(afterBoot, 1200);

console.log("Pupik AI запущен.");
