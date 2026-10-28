/**
 * Локальная генерация картинок на canvas (без облака / LLM).
 * Тема и палитра — из текста запроса.
 */

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickTheme(prompt) {
  const n = String(prompt || "").toLowerCase().replace(/ё/g, "е");
  const themes = [
    { id: "cat", keys: ["кот", "кошк", "cat", "kitten"], colors: ["#1a1a1a", "#f4a261", "#e9c46a", "#264653"] },
    { id: "dog", keys: ["собак", "пес", "пёс", "dog", "puppy"], colors: ["#8d6e63", "#ffe0b2", "#5d4037", "#fff8e1"] },
    { id: "sunset", keys: ["закат", "рассвет", "sunset", "sunrise", "небо"], colors: ["#ff6b35", "#f7c59f", "#2a9d8f", "#264653"] },
    { id: "sea", keys: ["море", "ocean", "sea", "волн", "beach"], colors: ["#0077b6", "#00b4d8", "#90e0ef", "#03045e"] },
    { id: "forest", keys: ["лес", "дерев", "forest", "nature", "природ"], colors: ["#1b4332", "#2d6a4f", "#95d5b2", "#081c15"] },
    {
      id: "football",
      keys: [
        "футбол", "мяч", "football", "soccer", "гол", "роналд", "ronaldo", "cr7",
        "месси", "messi", "реал", "madrid", "барса", "hala",
      ],
      colors: ["#1f6b45", "#7dffb3", "#0e1a14", "#e8fff2"],
    },
    { id: "space", keys: ["космос", "space", "звезд", "galaxy", "луна", "moon"], colors: ["#0b1026", "#7b2cbf", "#c77dff", "#f8f9fa"] },
    { id: "city", keys: ["город", "city", "небоскреб", "street"], colors: ["#212529", "#495057", "#ffd60a", "#adb5bd"] },
    { id: "flower", keys: ["цвет", "flower", "роз", "тюльпан"], colors: ["#ff0a54", "#ff85a1", "#fff0f3", "#590d22"] },
    { id: "robot", keys: ["робот", "robot", "аи", "ai", "pupik"], colors: ["#7dffb3", "#0e1a14", "#1f6b45", "#e8fff2"] },
  ];
  for (const t of themes) {
    if (t.keys.some((k) => n.includes(k))) return t;
  }
  const h = hash(n || "pupik");
  const palettes = [
    ["#7dffb3", "#0e1a14", "#1f6b45", "#e8fff2"],
    ["#ff6b6b", "#1a1a2e", "#16213e", "#e94560"],
    ["#4cc9f0", "#4361ee", "#3a0ca3", "#f72585"],
    ["#f4a261", "#e76f51", "#2a9d8f", "#264653"],
  ];
  return { id: "abstract", keys: [], colors: palettes[h % palettes.length] };
}

function drawScene(ctx, w, h, theme, rnd) {
  const [c0, c1, c2, c3] = theme.colors;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, c0);
  g.addColorStop(0.55, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // шум / пятна
  for (let i = 0; i < 28; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 20 + rnd() * 90;
    const rad = ctx.createRadialGradient(x, y, 0, x, y, r);
    rad.addColorStop(0, `${c3}55`);
    rad.addColorStop(1, `${c3}00`);
    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (theme.id === "cat" || theme.id === "dog") {
    ctx.fillStyle = c1;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.55, w * 0.22, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.38, w * 0.14, 0, Math.PI * 2);
    ctx.fill();
    if (theme.id === "cat") {
      ctx.beginPath();
      ctx.moveTo(w * 0.4, h * 0.32);
      ctx.lineTo(w * 0.36, h * 0.18);
      ctx.lineTo(w * 0.48, h * 0.3);
      ctx.moveTo(w * 0.6, h * 0.32);
      ctx.lineTo(w * 0.64, h * 0.18);
      ctx.lineTo(w * 0.52, h * 0.3);
      ctx.fill();
    }
    ctx.fillStyle = c0;
    ctx.beginPath();
    ctx.arc(w * 0.45, h * 0.36, 6, 0, Math.PI * 2);
    ctx.arc(w * 0.55, h * 0.36, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (theme.id === "football") {
    ctx.fillStyle = c3;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, Math.min(w, h) * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c0;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, Math.min(w, h) * 0.08, 0, Math.PI * 2);
    ctx.stroke();
  } else if (theme.id === "sunset" || theme.id === "sea") {
    ctx.fillStyle = c3;
    ctx.beginPath();
    ctx.arc(w * 0.7, h * 0.35, Math.min(w, h) * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `${c2}cc`;
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.strokeStyle = `${c3}88`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const y = h * 0.68 + i * 14;
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 20) {
        ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 4);
      }
      ctx.stroke();
    }
  } else if (theme.id === "space") {
    ctx.fillStyle = c3;
    for (let i = 0; i < 80; i++) {
      ctx.globalAlpha = 0.4 + rnd() * 0.6;
      ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = c2;
    ctx.beginPath();
    ctx.arc(w * 0.3, h * 0.4, 30 + rnd() * 20, 0, Math.PI * 2);
    ctx.fill();
  } else if (theme.id === "robot") {
    ctx.fillStyle = c0;
    ctx.fillRect(w * 0.35, h * 0.28, w * 0.3, h * 0.35);
    ctx.fillStyle = c1;
    ctx.fillRect(w * 0.4, h * 0.35, w * 0.08, h * 0.08);
    ctx.fillRect(w * 0.52, h * 0.35, w * 0.08, h * 0.08);
    ctx.fillRect(w * 0.42, h * 0.5, w * 0.16, h * 0.04);
  } else {
    // абстракция — геометрические формы
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? c2 : c3;
      ctx.globalAlpha = 0.35 + rnd() * 0.4;
      ctx.beginPath();
      if (rnd() > 0.5) {
        ctx.arc(rnd() * w, rnd() * h, 30 + rnd() * 70, 0, Math.PI * 2);
      } else {
        const x = rnd() * w;
        const y = rnd() * h;
        ctx.moveTo(x, y);
        ctx.lineTo(x + rnd() * 120 - 60, y + rnd() * 120);
        ctx.lineTo(x + rnd() * 80 - 40, y + rnd() * 80 - 40);
        ctx.closePath();
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // подпись
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, h - 36, w, 36);
  ctx.fillStyle = "#e8fff2";
  ctx.font = "600 13px Manrope, sans-serif";
  ctx.fillText("Pupik AI", 14, h - 14);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(ctx, img, x, y, bw, bh) {
  const ir = img.width / img.height;
  const br = bw / bh;
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (ir > br) {
    sw = img.height * br;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / br;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, bw, bh);
}

function drawPartnerSilhouette(ctx, w, h, label, rnd) {
  const x0 = w * 0.52;
  ctx.fillStyle = "rgba(14, 26, 20, 0.55)";
  ctx.fillRect(x0, 0, w - x0, h);
  // «звезда» — схематичная фигура + номер
  ctx.fillStyle = "#7dffb3";
  ctx.beginPath();
  ctx.ellipse(w * 0.76, h * 0.42, 48, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.76, h * 0.26, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0e1a14";
  ctx.font = "800 42px Bricolage Grotesque, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("7", w * 0.76, h * 0.48);
  ctx.fillStyle = "#e8fff2";
  ctx.font = "700 16px Manrope, sans-serif";
  ctx.fillText(label.slice(0, 18).toUpperCase(), w * 0.76, h * 0.78);
  // мяч
  ctx.strokeStyle = "#e8fff2";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w * 0.62 + rnd() * 10, h * 0.72, 18, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * @param {string} prompt
 * @param {{ photoDataUrl?: string }} [opts]
 */
export async function generateImage(prompt, opts = {}) {
  const theme = pickTheme(prompt);
  const rnd = mulberry32(hash(String(prompt) + "|" + theme.id));
  const w = 640;
  const h = 480;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  const withMe = wantsCollage(prompt) && opts.photoDataUrl;

  if (withMe) {
    try {
      const photo = await loadImage(opts.photoDataUrl);
      // фон стадиона
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#1f6b45");
      g.addColorStop(1, "#0e1a14");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      drawCover(ctx, photo, 16, 40, w * 0.46, h - 90);
      ctx.strokeStyle = "rgba(125,255,179,0.45)";
      ctx.lineWidth = 3;
      ctx.strokeRect(16, 40, w * 0.46, h - 90);
      const partner = partnerLabel(prompt);
      drawPartnerSilhouette(ctx, w, h, partner, rnd);
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, h - 40, w, 40);
      ctx.fillStyle = "#e8fff2";
      ctx.font = "600 13px Manrope, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("Pupik AI · коллаж с твоим фото", 14, h - 16);
      return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), theme: "collage" };
    } catch {
      /* fallback to scene */
    }
  }

  drawScene(ctx, w, h, theme, rnd);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.82),
    theme: theme.id,
  };
}

export function wantsCollage(text) {
  const n = String(text || "").toLowerCase().replace(/ё/g, "е");
  return (
    /сделай\s+меня|нарисуй\s+меня|добавь\s+меня|меня\s+с\s+|с\s+роналд|with\s+me|me\s+with|make\s+me\s+with|photo\s+with/.test(
      n
    ) || /меня\s+.+\s+с\s+/.test(n)
  );
}

function partnerLabel(text) {
  const n = String(text || "").toLowerCase().replace(/ё/g, "е");
  if (/роналд|ronaldo|cr7/.test(n)) return "CR7";
  if (/месси|messi/.test(n)) return "MESSI";
  if (/мбапп|mbappe/.test(n)) return "MBAPPÉ";
  const m = n.match(/(?:с|with)\s+([a-zа-яё0-9]{2,20})/i);
  return m ? m[1] : "STAR";
}

/** Вытаскивает тему из фразы про генерацию */
export function extractImagePrompt(text) {
  const n = String(text || "").trim();
  if (wantsCollage(n)) return n;
  const m = n.match(
    /(?:сгенер\p{L}*|нарису\p{L}*|создай\s+(?:картинк\p{L}*|изображен\p{L}*|фото)|сделай\s+(?:картинк\p{L}*|изображен\p{L}*|фото|меня)|generate\s+(?:an?\s+)?(?:image|picture|photo)|draw(?:\s+me)?|create\s+(?:an?\s+)?(?:image|picture))\s*(?:мне\s+)?(?:картинк\p{L}*|изображен\p{L}*|фото|image|picture|photo)?\s*(?:с\s+|of\s+|про\s+|:\s*)?(.+)/iu
  );
  if (m) {
    const rest = (m[1] || "").trim().replace(/^[«"']|[»"']$/g, "");
    if (rest.length > 1 && !/умеешь|можешь|can you/i.test(rest)) return rest;
  }
  if (
    /(кот|кошк|собак|закат|море|лес|космос|футбол|мяч|город|цвет|робот|роналд|месси|cat|dog|sunset|sea|forest|space|football|flower|robot|ronaldo)/i.test(
      n
    )
  ) {
    return n;
  }
  return "абстракция pupik";
}

export function wantsImage(text) {
  const s = String(text || "");
  if (wantsCollage(s)) return true;
  return /(?:сгенер|нарису|генер\p{L}*|генит\p{L}*|генир\p{L}*|generate\b.*\b(?:image|picture|photo)|draw(?:\s+me)?\b|создай\s+(?:картин|фото|изобр|меня)|сделай\s+(?:картин|фото|изобр|меня)|картинк\p{L}*|фото\s+умеешь|умеешь\s+.*(?:фото|картин|рисов))/iu.test(
    s
  );
}
