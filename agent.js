
const AgentMode = (() => {
  let enabled = false;
  let pendingAction = null;
  let projectDirectory = null;

  const $ = (id) => document.getElementById(id);

  function addStyles() {
    if ($("agent-mode-styles")) return;

    const style = document.createElement("style");
    style.id = "agent-mode-styles";
    style.textContent = `
      .agent-toolbar {
        display:flex; gap:8px; align-items:center;
        flex-wrap:wrap; margin:10px 0;
      }
      .agent-toggle, .agent-folder {
        border:1px solid #45465a; border-radius:10px;
        padding:9px 13px; background:#20212b;
        color:#eee; cursor:pointer; font-weight:600;
      }
      .agent-toggle.active {
        background:#245c48; border-color:#49c99b;
      }
      .agent-status { color:#aaa; font-size:12px; }
      .agent-card {
        border:1px solid #55566b; border-radius:12px;
        padding:14px; margin:10px 0; background:#191a24;
        color:#eee; overflow-wrap:anywhere;
      }
      .agent-card pre {
        white-space:pre-wrap; overflow-wrap:anywhere;
        max-height:240px; overflow:auto;
        background:#101117; padding:10px; border-radius:8px;
      }
      .agent-actions { display:flex; gap:8px; margin-top:12px; }
      .agent-actions button {
        padding:9px 12px; border:0; border-radius:8px;
        cursor:pointer; font-weight:600;
      }
      .agent-approve { background:#36b987; color:#071b13; }
      .agent-reject { background:#383947; color:white; }
    `;
    document.head.appendChild(style);
  }

  function addToolbar() {
    if ($("agent-toolbar")) return;

    const form = $("composer");
    if (!form) return;

    addStyles();

    const toolbar = document.createElement("div");
    toolbar.id = "agent-toolbar";
    toolbar.className = "agent-toolbar";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = "agent-toggle";
    toggle.className = "agent-toggle";
    toggle.textContent = "⚡ Режим агента: выкл";

    const folder = document.createElement("button");
    folder.type = "button";
    folder.className = "agent-folder";
    folder.textContent = "📁 Выбрать папку";

    const status = document.createElement("span");
    status.id = "agent-status";
    status.className = "agent-status";
    status.textContent = "Папка не выбрана";

    toggle.addEventListener("click", () => {
      enabled = !enabled;
      toggle.classList.toggle("active", enabled);
      toggle.textContent = enabled
        ? "⚡ Режим агента: вкл"
        : "⚡ Режим агента: выкл";

      status.textContent = enabled
        ? "Агент ждёт задачу"
        : "Обычный режим";
    });

    folder.addEventListener("click", chooseFolder);

    toolbar.append(toggle, folder, status);
    form.parentNode.insertBefore(toolbar, form);
  }

  async function chooseFolder() {
    if (!window.showDirectoryPicker) {
      alert(
        "Выбор папки не поддерживается этим браузером. " +
        "Открой Pupik AI в актуальном Chrome или Edge."
      );
      return;
    }

    try {
      projectDirectory = await window.showDirectoryPicker({
        mode: "readwrite"
      });

      $("agent-status").textContent =
        "Папка: " + projectDirectory.name;
    } catch (error) {
      if (error.name !== "AbortError") {
        alert("Не удалось выбрать папку проекта.");
      }
    }
  }

  function showCard(title, details, onApprove, onReject) {
    const log = $("log");
    if (!log) return;

    const card = document.createElement("section");
    card.className = "agent-card";

    const heading = document.createElement("strong");
    heading.textContent = title;

    const description = document.createElement("p");
    description.textContent = details;

    const actions = document.createElement("div");
    actions.className = "agent-actions";

    const approve = document.createElement("button");
    approve.className = "agent-approve";
    approve.textContent = "Разрешить";

    const reject = document.createElement("button");
    reject.className = "agent-reject";
    reject.textContent = "Отклонить";

    approve.addEventListener("click", async () => {
      approve.disabled = true;
      reject.disabled = true;

      try {
        await onApprove();
      } catch (error) {
        alert("Ошибка: " + error.message);
      } finally {
        card.remove();
        pendingAction = null;
      }
    });

    reject.addEventListener("click", () => {
      onReject?.();
      card.remove();
      pendingAction = null;
    });

    actions.append(approve, reject);
    card.append(heading, description, actions);
    log.appendChild(card);
    log.scrollTop = log.scrollHeight;
  }

  function requestPermission(title, details, action) {
    if (pendingAction) {
      alert("Сначала разреши или отклони текущее действие.");
      return;
    }

    pendingAction = action;

    showCard(
      "🔐 Агент запрашивает разрешение",
      title + "\n\n" + details,
      async () => {
        await action();
      },
      () => {
        const status = $("agent-status");
        if (status) status.textContent = "Действие отклонено";
      }
    );
  }

  async function listFiles() {
    if (!projectDirectory) {
      alert("Сначала нажми «Выбрать папку».");
      return;
    }

    const names = [];

    for await (const [name, handle] of projectDirectory.entries()) {
      names.push((handle.kind === "directory" ? "📁 " : "📄 ") + name);
    }

    showCard(
      "📂 Файлы проекта",
      names.length ? names.join("\n") : "Папка пустая",
      async () => {},
      () => {}
    );
  }

  async function readFile(name) {
    if (!projectDirectory) {
      throw new Error("Сначала выбери папку проекта.");
    }

    if (
      !/^[\w .()-]+\.(js|mjs|cjs|html|css|json|md|txt|py|ts)$/i.test(name)
    ) {
      throw new Error("Недопустимое имя файла.");
    }

    const handle = await projectDirectory.getFileHandle(name);
    const file = await handle.getFile();
    return await file.text();
  }

  function proposeFileWrite(name, content) {
    if (!projectDirectory) {
      alert("Сначала выбери папку проекта.");
      return;
    }

    if (
      !/^[\w .()-]+\.(js|mjs|cjs|html|css|json|md|txt|py|ts)$/i.test(name)
    ) {
      alert("Недопустимое имя файла.");
      return;
    }

    requestPermission(
      "Изменить файл " + name + "?",
      "Будет записано новое содержимое файла. Старое содержимое будет заменено.\n\n" +
        String(content).slice(0, 2500),
      async () => {
        const handle = await projectDirectory.getFileHandle(name);
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();

        const status = $("agent-status");
        if (status) status.textContent = "Изменён файл: " + name;
      }
    );
  }

  function handleCommand(text) {
    if (!enabled) return false;

    const command = text.trim();

    if (/^(покажи|список)\s+(файлы|файлов)|^list files$/i.test(command)) {
      requestPermission(
        "Посмотреть список файлов проекта",
        "Агент прочитает названия файлов в выбранной папке.",
        listFiles
      );
      return true;
    }

    const readMatch = command.match(
      /^(?:прочитай|открой|покажи код файла)\s+([\w .()-]+\.(?:js|mjs|cjs|html|css|json|md|txt|py|ts))$/i
    );

    if (readMatch) {
      requestPermission(
        "Прочитать файл " + readMatch[1],
        "Агент прочитает содержимое файла из выбранной папки.",
        async () => {
          const content = await readFile(readMatch[1]);
          showCard("📄 " + readMatch[1], content, async () => {}, () => {});
        }
      );
      return true;
    }

    addMessage(
      "Режим агента включён. Я могу просматривать файлы и записывать " +
      "предложенное содержимое после твоего разрешения. Для автоматического " +
      "исправления кода нужна подключённая языковая модель."
    );
    return true;
  }

  function addMessage(text) {
    const log = $("log");
    if (!log) return;

    const row = document.createElement("div");
    row.className = "row ai";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;

    row.appendChild(bubble);
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }

  function init() {
    addToolbar();
  }

  return {
    init,
    isEnabled: () => enabled,
    handleCommand,
    proposeFileWrite
  };
})();

window.AgentMode = AgentMode;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", AgentMode.init);
} else {
  AgentMode.init();
}
