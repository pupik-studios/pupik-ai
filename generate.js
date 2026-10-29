
/**
 * Pupik AI — генератор изображений через Pollinations AI.
 * Водяной знак: Polinations AI.
 */

const W = 1024;
const H = 1024;
const API_URL = "https://gen.pollinations.ai/image/";

function normalize(text) {
  return String(text || "").toLowerCase().replace(/ё/g, "е").trim();
}

export function wantsCollage(text) {
  const p = normalize(text);
  return /сделай\s+меня|нарисуй\s+меня|добавь\s+меня|меня\s+с\s+|with\s+me|me\s+with|make\s+me\s+with|photo\s+with/.test(p);
}

export function wantsImage(text) {
  const p = normalize(text);
  return /нарисуй|нарисовать|сгенер|генерируй|создай|сделай|картинк|изображение|фотографию|\bdraw\b|\bgenerate\b|\bmake\s+an?\s+image\b/.test(p);
}

export function extractImagePrompt(text) {
  const p = String(text || "").trim();

  const match = p.match(
    /(?:нарисуй|нарисовать|сгенерируй|сгенерировать|создай|сделай)\s+(?:(?:мне)\s+)?(?:(?:картинку|изображение|фото|рисунок)\s*)?(?:про\s+|с\s+|of\s+)?(.+)/i
  );

  return match?.[1]?.trim() || p || "Красивый пейзаж";
}

function addWatermark(ctx) {
  const text = "Polinations AI";

  ctx.save();
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";

  const x = W - 18;
  const y = H - 16;
  const width = ctx.measureText(text).width;

  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(W - width - 34, H - 49, width + 24, 34);

  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x - 6, y - 4);
  ctx.restore();
}

function imageToDataUrl(img) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Не удалось создать холст для изображения.");
  }

  // Сохраняем пропорции исходного изображения.
  const scale = Math.min(W / img.width, H / img.height);
  const width = img.width * scale;
  const height = img.height * scale;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, (W - width) / 2, (H - height) / 2, width, height);

  addWatermark(ctx);

  return canvas.toDataURL("image/png");
}

async function loadGeneratedImage(blob) {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const img = new Image();

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(
        new Error("Сервис вернул файл, который не удалось открыть как изображение.")
      );
      img.src = objectUrl;
    });

    return imageToDataUrl(img);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * @param {string} prompt — описание изображения
 * @param {{ apiKey?: string, model?: string, seed?: number }} opts
 */
export async function generateImage(prompt, opts = {}) {
  const description = String(prompt || "").trim();

  if (!description) {
    throw new Error("Сначала напиши, что нужно нарисовать.");
  }

  // Не вставляй секретный sk_-ключ в публичный сайт.
  const apiKey =
    opts.apiKey ||
    (typeof localStorage !== "undefined"
      ? localStorage.getItem("pollinations_api_key")
      : null);

  if (!apiKey) {
    throw new Error(
      "Не настроен доступ к Pollinations AI. Сначала подключи API-ключ через настройки приложения."
    );
  }

  const model = opts.model || "flux";
  const url = new URL(
    encodeURIComponent(description),
    API_URL
  );

  url.searchParams.set("model", model);
  url.searchParams.set("width", String(W));
  url.searchParams.set("height", String(H));
  url.searchParams.set("safe", "true");

  if (Number.isInteger(opts.seed)) {
    url.searchParams.set("seed", String(opts.seed));
  }

  let response;

  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "image/*"
      }
    });
  } catch {
    throw new Error(
      "Не удалось связаться с Pollinations AI. Проверь интернет и доступность сервиса."
    );
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Ключ не принят или у него нет доступа. Проверь подключение Pollinations AI."
      );
    }

    if (response.status === 429) {
      throw new Error(
        "Слишком много запросов. Подожди немного и попробуй ещё раз."
      );
    }

    throw new Error(
      `Pollinations AI вернул ошибку ${response.status}. Попробуй позже.`
    );
  }

  const blob = await response.blob();

  if (!blob.type.startsWith("image/")) {
    throw new Error(
      "Сервис не вернул изображение. Попробуй изменить описание."
    );
  }

  const dataUrl = await loadGeneratedImage(blob);

  return {
    dataUrl,
    theme: "pollinations",
    prompt: description
  };
}
