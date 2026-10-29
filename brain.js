
import { createAgent } from "./agent.js";

export function createPupikBrain(savedState = null) {
  const agent = createAgent();
  const state = {
    lang: savedState?.lang || "ru",
    messages: Array.isArray(savedState?.messages)
      ? savedState.messages
      : [],
    name: savedState?.name || "Pupik"
  };

  function detectLanguage(text) {
    return /[а-яё]/i.test(text) ? "ru" : "en";
  }

  function greeting() {
    return state.lang === "en"
      ? "Hello! I'm Pupik, your task agent. What would you like me to do?"
      : "Привет! Я Pupik — агент для выполнения задач. Что нужно сделать?";
  }

  function resetConversation() {
    state.messages = [];
    return greeting();
  }

  function getLang() {
    return state.lang;
  }

  function snapshot() {
    return {
      lang: state.lang,
      messages: state.messages.slice(-100),
      name: state.name,
      agent: agent.snapshot()
    };
  }

  function normalize(text) {
    return String(text || "").trim().toLowerCase();
  }

  async function reply(text) {
    const input = String(text || "").trim();

    if (!input) {
      return {
        type: "text",
        text: state.lang === "en"
          ? "Please enter a task."
          : "Напиши задачу."
      };
    }

    state.lang = detectLanguage(input);

    state.messages.push({
      role: "user",
      text: input,
      time: Date.now()
    });

    const query = normalize(input);

    let answer;

    if (/^(привет|здравствуй|здравствуйте|хай|hello|hi)\b/i.test(query)) {
      answer = greeting();
    } else if (/^(пока|до свидания|bye)\b/i.test(query)) {
      answer = state.lang === "en"
        ? "Goodbye! See you next time."
        : "Пока! До следующего раза.";
    } else if (
      /^(кто ты|что ты умеешь|what can you do|who are you)\??$/.test(query)
    ) {
      answer = state.lang === "en"
        ? "I'm Pupik, an algorithmic agent. I can follow programmed workflows, use connected tools and calculate expressions."
        : "Я Pupik — алгоритмический агент. Я могу выполнять запрограммированные действия, использовать подключённые инструменты и вычислять выражения.";
    } else {
      const calculation = input.match(
        /(?:посчитай|вычисли|calculate|compute)\s+(.+)/i
      );

      if (calculation) {
        try {
          const result = await agent.useTool("calculate", {
            expression: calculation[1]
          });

          answer = `${calculation[1]} = ${result.result}`;
        } catch {
          answer = state.lang === "en"
            ? "I couldn't calculate that expression."
            : "Не удалось вычислить это выражение.";
        }
      } else {
        const task = await agent.run(input);

        answer = task.answer;
      }
    }

    state.messages.push({
      role: "assistant",
      text: answer,
      time: Date.now()
    });

    return {
      type: "text",
      text: answer
    };
  }

  function replyFile(file) {
    const isEnglish = state.lang === "en";

    if (file?.kind === "text" && file.preview) {
      return {
        type: "text",
        text: isEnglish
          ? `File received: ${file.name}. Its preview is available for processing by a connected file tool.`
          : `Файл получен: ${file.name}. Для полноценного анализа подключи инструмент чтения файлов.`
      };
    }

    if (file?.kind === "image") {
      return {
        type: "text",
        text: isEnglish
          ? `Image received: ${file.name}. Image analysis requires an image-processing tool.`
          : `Изображение получено: ${file.name}. Для анализа изображения нужен специальный инструмент.`
      };
    }

    return {
      type: "text",
      text: isEnglish
        ? `File received: ${file?.name || "unknown file"}.`
        : `Файл получен: ${file?.name || "неизвестный файл"}.`
    };
  }

  return {
    greeting,
    reply,
    replyFile,
    resetConversation,
    getLang,
    snapshot
  };
}
