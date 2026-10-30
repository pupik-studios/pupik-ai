/**
 * Pupik AI — локальный генератор рисунков.
 * Без внешних API и облачных моделей.
 */

const W = 640;
const H = 480;

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .trim();
}

function hash(text) {
  let h = 2166136261;

  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return h >>> 0;
}

function randomGenerator(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function has(text, words) {
  return words.some(word => text.includes(word));
}

function detectTheme(prompt) {
  const p = normalize(prompt);

  const themes = [
    {
      id: "beaver",
      words: ["бобер", "бобра", "бобру", "бобром", "бобры", "beaver"],
      bg: "#b8e0c5",
      fur: "#8b5738"
    },
    {
      id: "cat",
      words: ["кот", "кота", "кошк", "котен", "cat", "kitten"],
      bg: "#d9edff",
      fur: "#e9a45b"
    },
    {
      id: "dog",
      words: ["собак", "пес", "пёс", "щен", "dog", "puppy"],
      bg: "#f7e4bd",
      fur: "#a86f43"
    },
    {
      id: "rabbit",
      words: ["кролик", "заяц", "зайца", "зайчик", "rabbit", "bunny"],
      bg: "#e7e0ff",
      fur: "#eee8df"
    },
    {
      id: "fox",
      words: ["лиса", "лису", "лис", "fox"],
      bg: "#d8edff",
      fur: "#e87532"
    },
    {
      id: "bear",
      words: ["медвед", "мишка", "bear"],
      bg: "#d7edcf",
      fur: "#805338"
    },
    {
      id: "bird",
      words: ["птиц", "попуг", "орел", "орёл", "сова", "bird", "parrot", "owl"],
      bg: "#c8edff",
      fur: "#e9a93c"
    },
    {
      id: "fish",
      words: ["рыба", "рыбу", "рыбк", "акул", "fish", "shark"],
      bg: "#a6e5f5",
      fur: "#ff9b54"
    },
    {
      id: "lion",
      words: ["лев", "льва", "львенок", "lion"],
      bg: "#ffe4a8",
      fur: "#d79a35"
    },
    {
      id: "elephant",
      words: ["слон", "слона", "elephant"],
      bg: "#d7e2ef",
      fur: "#8d9baa"
    },
    {
      id: "frog",
      words: ["лягуш", "жаба", "frog"],
      bg: "#d9f3bc",
      fur: "#48a85b"
    },
    {
      id: "butterfly",
      words: ["бабоч", "butterfly"],
      bg: "#ffe0ed",
      fur: "#d85dbe"
    },
    {
      id: "horse",
      words: ["лошад", "конь", "коня", "horse"],
      bg: "#c9e9ff",
      fur: "#9c613e"
    },
    {
      id: "flower",
      words: ["цветок", "цветы", "розу", "роза", "тюльпан", "flower", "rose"],
      bg: "#dff5d7",
      fur: "#f16c9b"
    },
    {
      id: "tree",
      words: ["дерево", "деревья", "дуб", "елка", "ёлка", "tree", "forest"],
      bg: "#d7f0d1",
      fur: "#347c45"
    },
    {
      id: "house",
      words: ["дом", "домик", "здание", "house", "building"],
      bg: "#bde4ff",
      fur: "#e9b46a"
    },
    {
      id: "car",
      words: ["машина", "автомобиль", "авто", "car", "ferrari", "bmw"],
      bg: "#d9e9ff",
      fur: "#e63946"
    },
    {
      id: "footballer",
      words: ["роналд", "роналду", "криштиан", "криштиану", "месси", "футболист", "меня", "cr7"],
      bg: "#b7e7c4",
      fur: "#e0b088"
    },
    {
      id: "football",
      words: ["футбол", "мяч", "football", "soccer", "ball"],
      bg: "#b5e8bb",
      fur: "#ffffff"
    },
    {
      id: "space",
      words: ["космос", "галактик", "звезд", "луна", "планет", "space", "galaxy", "moon", "planet"],
      bg: "#111735",
      fur: "#b88cff"
    },
    {
      id: "sea",
      words: ["море", "океан", "пляж", "волны", "sea", "ocean", "beach"],
      bg: "#78d6ed",
      fur: "#ffffff"
    },
    {
      id: "sunset",
      words: ["закат", "рассвет", "солнце", "sunset", "sunrise", "sun"],
      bg: "#ffbc88",
      fur: "#ffdf70"
    },
    {
      id: "robot",
      words: ["робот", "robot", "pupik"],
      bg: "#c8f4df",
      fur: "#68b9a4"
    },
    {
      id: "person",
      words: ["человек", "мальчик", "девочка", "мужчина", "женщина", "ребенок", "ребёнок", "person", "boy", "girl"],
      bg: "#d8eaff",
      fur: "#dca477"
    },
    {
      id: "burger",
      words: ["бургер", "гамбургер", "чизбургер", "burger"],
      bg: "#f6e7c8",
      fur: "#e2a04a"
    }
  ];

  for (const theme of themes) {
    if (has(p, theme.words)) {
      return theme;
    }
  }

  return {
    id: "landscape",
    bg: "#d5eaff",
    fur: "#73a77a"
  };
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, color, rotation = 0) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fill();
}

function polygon(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);

  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }

  ctx.closePath();
  ctx.fill();
}

function line(ctx, x1, y1, x2, y2, color, width = 3) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function background(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  circle(ctx, 530, 80, 34, "rgba(255,255,255,0.3)");
}

function ground(ctx, color = "#8fca88") {
  ellipse(ctx, 320, 430, 400, 95, color);
}

function eyes(ctx, x, y, spacing = 25) {
  circle(ctx, x - spacing / 2, y, 7, "#ffffff");
  circle(ctx, x + spacing / 2, y, 7, "#ffffff");
  circle(ctx, x - spacing / 2, y, 3.5, "#222222");
  circle(ctx, x + spacing / 2, y, 3.5, "#222222");
}

function drawBeaver(ctx) {
  // Земля и лужайка
  ground(ctx, "#80b96d");

  // Большой плоский хвост
  ellipse(ctx, 420, 365, 100, 39, "#60402f", -0.18);

  ctx.strokeStyle = "#3e2b23";
  ctx.lineWidth = 3;

  for (let i = 0; i < 5; i++) {
    line(ctx, 360 + i * 22, 350 - i * 3, 370 + i * 22, 382 - i * 3, "#3e2b23", 2);
  }

  // Лапы
  ellipse(ctx, 240, 365, 43, 20, "#68432d");
  ellipse(ctx, 365, 360, 43, 20, "#68432d");

  // Тело
  ellipse(ctx, 305, 315, 115, 87, "#98613d");

  // Светлая грудка
  ellipse(ctx, 290, 339, 65, 53, "#c99a6d");

  // Голова
  circle(ctx, 306, 218, 80, "#98613d");

  // Уши
  circle(ctx, 244, 164, 21, "#68432d");
  circle(ctx, 369, 164, 21, "#68432d");
  circle(ctx, 244, 164, 11, "#d7a37a");
  circle(ctx, 369, 164, 11, "#d7a37a");

  // Морда
  ellipse(ctx, 306, 246, 55, 36, "#d8b18a");

  // Нос
  ellipse(ctx, 306, 231, 16, 11, "#28221e");

  // Глаза
  eyes(ctx, 306, 201, 45);

  // Передние зубы
  ctx.fillStyle = "#fff8dc";
  ctx.fillRect(297, 255, 10, 19);
  ctx.fillRect(308, 255, 10, 19);

  line(ctx, 307, 267, 307, 283, "#68432d", 2);

  // Ветки рядом
  line(ctx, 95, 370, 135, 330, "#70472e", 9);
  line(ctx, 118, 348, 115, 323, "#70472e", 5);
  line(ctx, 125, 342, 153, 344, "#70472e", 5);
}

function drawCat(ctx, fur) {
  ground(ctx);

  ellipse(ctx, 320, 350, 100, 80, fur);
  circle(ctx, 320, 235, 88, fur);

  polygon(ctx, [[250, 195], [250, 118], [297, 176]], fur);
  polygon(ctx, [[343, 176], [390, 118], [390, 195]], fur);

  polygon(ctx, [[263, 180], [264, 142], [286, 174]], "#f4b1b1");
  polygon(ctx, [[354, 174], [378, 142], [378, 180]], "#f4b1b1");

  eyes(ctx, 320, 225, 48);

  polygon(ctx, [[307, 248], [333, 248], [320, 263]], "#e98291");

  line(ctx, 320, 260, 320, 275, "#49342d", 3);
  line(ctx, 320, 275, 306, 280, "#49342d", 2);
  line(ctx, 320, 275, 334, 280, "#49342d", 2);

  line(ctx, 282, 257, 228, 248, "#49342d", 2);
  line(ctx, 282, 267, 226, 270, "#49342d", 2);
  line(ctx, 358, 257, 412, 248, "#49342d", 2);
  line(ctx, 358, 267, 414, 270, "#49342d", 2);

  ellipse(ctx, 408, 340, 23, 66, fur, -0.5);
}

function drawDog(ctx, fur) {
  ground(ctx);

  ellipse(ctx, 320, 335, 112, 85, fur);
  circle(ctx, 320, 225, 83, fur);

  ellipse(ctx, 250, 225, 24, 55, "#68432d", -0.4);
  ellipse(ctx, 390, 225, 24, 55, "#68432d", 0.4);

  ellipse(ctx, 320, 250, 48, 33, "#f0d3ae");
  circle(ctx, 320, 238, 13, "#292929");

  eyes(ctx, 320, 206, 43);

  line(ctx, 320, 254, 320, 269, "#68432d", 3);
  line(ctx, 320, 269, 307, 276, "#68432d", 2);
  line(ctx, 320, 269, 333, 276, "#68432d", 2);

  ellipse(ctx, 260, 399, 38, 15, fur);
  ellipse(ctx, 380, 399, 38, 15, fur);

  line(ctx, 419, 326, 454, 290, fur, 14);
}

function drawRabbit(ctx, fur) {
  ground(ctx);

  ellipse(ctx, 320, 348, 85, 82, fur);
  circle(ctx, 320, 240, 76, fur);

  ellipse(ctx, 286, 146, 21, 72, fur, -0.12);
  ellipse(ctx, 354, 146, 21, 72, fur, 0.12);

  ellipse(ctx, 286, 146, 10, 53, "#efa5b5", -0.12);
  ellipse(ctx, 354, 146, 10, 53, "#efa5b5", 0.12);

  eyes(ctx, 320, 231, 38);
  circle(ctx, 320, 254, 7, "#e88e9c");

  ellipse(ctx, 310, 265, 13, 9, "#ffffff");
  ellipse(ctx, 330, 265, 13, 9, "#ffffff");

  circle(ctx, 400, 360, 22, "#ffffff");
}

function drawFox(ctx, fur) {
  ground(ctx);

  ellipse(ctx, 320, 350, 98, 70, fur);
  ellipse(ctx, 404, 360, 78, 32, fur, -0.6);
  ellipse(ctx, 440, 330, 31, 22, "#ffffff", -0.6);

  circle(ctx, 320, 235, 76, fur);

  polygon(ctx, [[260, 200], [250, 125], [302, 177]], fur);
  polygon(ctx, [[338, 177], [390, 125], [380, 200]], fur);

  polygon(ctx, [[281, 246], [359, 246], [320, 292]], "#fff0d9");

  eyes(ctx, 320, 221, 40);
  circle(ctx, 320, 251, 8, "#252525");
}

function drawBear(ctx, fur) {
  ground(ctx);

  ellipse(ctx, 320, 335, 115, 93, fur);
  circle(ctx, 320, 220, 86, fur);

  circle(ctx, 257, 158, 29, fur);
  circle(ctx, 383, 158, 29, fur);
  circle(ctx, 257, 158, 14, "#d6a17f");
  circle(ctx, 383, 158, 14, "#d6a17f");

  ellipse(ctx, 320, 246, 44, 31, "#d8b18a");
  circle(ctx, 320, 234, 10, "#29211d");

  eyes(ctx, 320, 206, 44);

  ellipse(ctx, 260, 401, 43, 20, fur);
  ellipse(ctx, 380, 401, 43, 20, fur);
}

function drawBird(ctx, fur) {
  ground(ctx);

  ellipse(ctx, 320, 300, 83, 105, fur, -0.25);
  circle(ctx, 320, 202, 65, fur);

  ellipse(ctx, 302, 302, 49, 68, "#fff0c4", -0.35);

  polygon(ctx, [[375, 205], [423, 222], [375, 238]], "#f4a62a");

  circle(ctx, 340, 190, 8, "#ffffff");
  circle(ctx, 342, 190, 4, "#202020");

  polygon(ctx, [[265, 270], [205, 310], [276, 324]], "#b77b38");

  line(ctx, 305, 390, 298, 420, "#8c5d32", 5);
  line(ctx, 340, 390, 345, 420, "#8c5d32", 5);
}

function drawFish(ctx, fur) {
  ground(ctx, "#76c8b4");

  ellipse(ctx, 305, 260, 120, 75, fur);
  polygon(ctx, [[420, 260], [500, 205], [500, 315]], fur);
  polygon(ctx, [[280, 200], [325, 157], [355, 204]], "#f6d365");

  circle(ctx, 360, 245, 11, "#ffffff");
  circle(ctx, 363, 245, 5, "#202020");

  line(ctx, 260, 285, 325, 285, "#ffffff", 4);
}

function drawLion(ctx, fur) {
  ground(ctx);

  circle(ctx, 320, 252, 105, "#bf792b");
  circle(ctx, 320, 242, 76, fur);

  circle(ctx, 263, 188, 25, fur);
  circle(ctx, 377, 188, 25, fur);

  ellipse(ctx, 320, 270, 43, 29, "#f4d3a5");
  circle(ctx, 320, 259, 10, "#38261b");

  eyes(ctx, 320, 222, 42);
}

function drawElephant(ctx, fur) {
  ground(ctx);

  ellipse(ctx, 320, 326, 115, 92, fur);
  circle(ctx, 320, 223, 82, fur);

  ellipse(ctx, 245, 224, 38, 58, "#a8b6c6");
  ellipse(ctx, 395, 224, 38, 58, "#a8b6c6");

  ellipse(ctx, 320, 265, 23, 44, fur);
  ellipse(ctx, 320, 298, 17, 26, fur);

  eyes(ctx, 320, 207, 42);
}

function drawFrog(ctx, fur) {
  ground(ctx);

  ellipse(ctx, 320, 325, 105, 90, fur);

  circle(ctx, 270, 220, 35, fur);
  circle(ctx, 370, 220, 35, fur);

  circle(ctx, 270, 220, 18, "#ffffff");
  circle(ctx, 370, 220, 18, "#ffffff");
  circle(ctx, 270, 220, 8, "#222222");
  circle(ctx, 370, 220, 8, "#222222");

  ctx.strokeStyle = "#205d36";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(320, 280, 38, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function drawButterfly(ctx, fur) {
  ground(ctx, "#d4eab8");

  ellipse(ctx, 260, 230, 68, 78, fur, -0.5);
  ellipse(ctx, 380, 230, 68, 78, "#5ca8ff", 0.5);
  ellipse(ctx, 270, 320, 52, 43, "#ffbd69", -0.5);
  ellipse(ctx, 370, 320, 52, 43, "#c77dff", 0.5);

  ellipse(ctx, 320, 275, 13, 75, "#493a65");
  circle(ctx, 320, 190, 17, "#493a65");

  line(ctx, 315, 180, 300, 155, "#493a65", 3);
  line(ctx, 325, 180, 340, 155, "#493a65", 3);
}

function drawHorse(ctx, fur) {
  ground(ctx);

  ellipse(ctx, 320, 320, 115, 70, fur);
  ellipse(ctx, 255, 265, 36, 84, fur, -0.3);
  circle(ctx, 260, 190, 51, fur);

  polygon(ctx, [[230, 160], [229, 120], [250, 153]], fur);
  polygon(ctx, [[265, 153], [289, 120], [283, 173]], fur);

  ellipse(ctx, 274, 207, 23, 16, "#f0d4b1");
  circle(ctx, 273, 181, 5, "#ffffff");
  circle(ctx, 275, 181, 2.5, "#222222");

  line(ctx, 270, 365, 260, 414, fur, 16);
  line(ctx, 355, 365, 360, 414, fur, 16);
}

function drawFlower(ctx, fur) {
  ground(ctx, "#a6d88d");

  line(ctx, 320, 300, 320, 423, "#39834a", 10);
  ellipse(ctx, 290, 360, 32, 14, "#5cae60", -0.4);
  ellipse(ctx, 352, 385, 32, 14, "#5cae60", 0.4);

  const petals = 10;

  for (let i = 0; i < petals; i++) {
    const a = (Math.PI * 2 * i) / petals;
    ellipse(
      ctx,
      320 + Math.cos(a) * 57,
      190 + Math.sin(a) * 57,
      27,
      39,
      fur,
      a
    );
  }

  circle(ctx, 320, 190, 36, "#f7d45d");
}

function drawTree(ctx, fur) {
  ground(ctx, "#a6d88d");

  polygon(ctx, [
    [280, 400], [285, 270], [350, 270], [360, 400]
  ], "#815538");

  circle(ctx, 320, 220, 100, fur);
  circle(ctx, 255, 255, 67, fur);
  circle(ctx, 385, 255, 67, fur);
  circle(ctx, 320, 160, 68, fur);
}

function drawHouse(ctx, fur) {
  ground(ctx, "#8fca88");

  ctx.fillStyle = "#f5d3a4";
  ctx.fillRect(190, 220, 260, 180);

  polygon(ctx, [
    [160, 225], [320, 105], [480, 225]
  ], "#bc5946");

  ctx.fillStyle = "#85513b";
  ctx.fillRect(285, 300, 70, 100);

  ctx.fillStyle = "#a9e4ff";
  ctx.fillRect(215, 255, 48, 48);
  ctx.fillRect(380, 255, 48, 48);

  line(ctx, 239, 255, 239, 303, "#ffffff", 3);
  line(ctx, 215, 279, 263, 279, "#ffffff", 3);
  line(ctx, 404, 255, 404, 303, "#ffffff", 3);
  line(ctx, 380, 279, 428, 279, "#ffffff", 3);
}

function drawCar(ctx, fur) {
  ground(ctx, "#c5dfc0");

  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.moveTo(140, 300);
  ctx.lineTo(200, 230);
  ctx.lineTo(380, 230);
  ctx.lineTo(445, 300);
  ctx.lineTo(490, 320);
  ctx.lineTo(490, 370);
  ctx.lineTo(135, 370);
  ctx.lineTo(135, 320);
  ctx.closePath();
  ctx.fill();

  polygon(ctx, [
    [220, 240], [365, 240], [410, 295], [180, 295]
  ], "#aee4ff");

  circle(ctx, 215, 370, 37, "#242424");
  circle(ctx, 215, 370, 17, "#cbd2d9");
  circle(ctx, 415, 370, 37, "#242424");
  circle(ctx, 415, 370, 17, "#cbd2d9");

  ctx.fillStyle = "#fff4c2";
  ctx.fillRect(140, 320, 28, 20);
  ctx.fillRect(460, 320, 28, 20);
}

function drawFootball(ctx) {
  ground(ctx, "#65a968");

  // Разметка поля
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 3;
  ctx.strokeRect(45, 65, 550, 340);
  ctx.beginPath();
  ctx.moveTo(320, 65);
  ctx.lineTo(320, 405);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(320, 235, 55, 0, Math.PI * 2);
  ctx.stroke();

  // Большой футбольный мяч
  circle(ctx, 320, 235, 100, "#ffffff");
  circle(ctx, 320, 235, 27, "#222222");

  polygon(ctx, [[320, 208], [344, 224], [335, 252], [305, 252], [296, 224]], "#222222");

  line(ctx, 320, 135, 320, 165, "#222222", 3);
  line(ctx, 320, 305, 320, 335, "#222222", 3);
  line(ctx, 225, 210, 270, 222, "#222222", 3);
  line(ctx, 415, 210, 370, 222, "#222222", 3);
}

function drawSpace(ctx, rnd) {
  for (let i = 0; i < 100; i++) {
    circle(ctx, rnd() * W, rnd() * H, 1 + rnd() * 2, "#ffffff");
  }

  circle(ctx, 390, 210, 92, "#9867e8");
  circle(ctx, 370, 190, 80, "#bd98ff");

  ellipse(ctx, 390, 220, 130, 28, "#d3c1ff", -0.3);

  circle(ctx, 150, 120, 36, "#e5e5ff");
  circle(ctx, 510, 355, 24, "#7bd5ff");
}

function drawSea(ctx) {
  ctx.fillStyle = "#83d8ed";
  ctx.fillRect(0, 0, W, 300);

  circle(ctx, 500, 90, 42, "#ffe89b");

  ctx.fillStyle = "#168db7";
  ctx.fillRect(0, 300, W, 180);

  for (let i = 0; i < 8; i++) {
    const y = 320 + i * 20;
    line(ctx, 30, y, 150, y, "#a7eaff", 4);
    line(ctx, 280, y + 5, 420, y + 5, "#a7eaff", 4);
    line(ctx, 490, y - 4, 600, y - 4, "#a7eaff", 4);
  }

  polygon(ctx, [[0, 420], [100, 390], [220, 430], [360, 405], [480, 430], [640, 400], [640, 480], [0, 480]], "#e9d3a1");
}

function drawSunset(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#fb7d8c");
  g.addColorStop(0.55, "#ffbd80");
  g.addColorStop(1, "#575b8b");

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  circle(ctx, 440, 235, 75, "#ffe7a0");

  polygon(ctx, [
    [0, 350], [130, 240], [240, 350], [390, 260],
    [520, 350], [640, 270], [640, 480], [0, 480]
  ], "#485575");
}

function drawRobot(ctx, fur) {
  ground(ctx, "#a4d5b4");

  ctx.fillStyle = fur;
  ctx.fillRect(230, 180, 180, 170);

  ctx.fillStyle = "#ecfff7";
  ctx.fillRect(255, 210, 45, 42);
  ctx.fillRect(340, 210, 45, 42);

  circle(ctx, 278, 231, 8, "#1b3d3a");
  circle(ctx, 363, 231, 8, "#1b3d3a");

  ctx.fillStyle = "#244b47";
  ctx.fillRect(275, 285, 90, 12);

  line(ctx, 320, 180, 320, 135, "#4b8f80", 7);
  circle(ctx, 320, 125, 13, "#f6ca6a");

  line(ctx, 230, 230, 180, 270, fur, 15);
  line(ctx, 410, 230, 460, 270, fur, 15);

  line(ctx, 270, 350, 260, 400, "#4b8f80", 20);
  line(ctx, 370, 350, 380, 400, "#4b8f80", 20);
}

function drawFootballer(ctx, fur) {
  ground(ctx, "#3e9a52");
  ctx.fillStyle = "#2f7d40";
  ctx.fillRect(0, 300, W, 180);

  circle(ctx, 470, 360, 28, "#f7f7f7");
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(470, 360, 28, 0, Math.PI * 2);
  ctx.stroke();

  polygon(ctx, [
    [250, 250], [390, 250], [415, 390], [225, 390]
  ], "#f4f4f4");

  ctx.fillStyle = "#111";
  ctx.font = "bold 42px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("7", 320, 340);

  ctx.fillStyle = fur;
  ctx.fillRect(296, 214, 48, 42);
  circle(ctx, 320, 168, 62, fur);
  ellipse(ctx, 320, 128, 58, 26, "#2b241c");
  eyes(ctx, 320, 168, 34);
  line(ctx, 300, 198, 340, 198, "#8a5344", 3);

  line(ctx, 258, 280, 190, 340, "#f4f4f4", 22);
  line(ctx, 382, 280, 450, 330, "#f4f4f4", 22);
  line(ctx, 275, 390, 268, 445, "#f4f4f4", 24);
  line(ctx, 365, 390, 372, 445, "#f4f4f4", 24);
}

function drawPerson(ctx, fur) {
  ground(ctx);

  // Тело и одежда
  polygon(ctx, [
    [255, 275], [385, 275], [410, 390], [230, 390]
  ], "#3974b8");

  // Шея
  ctx.fillStyle = fur;
  ctx.fillRect(298, 245, 44, 42);

  // Голова
  circle(ctx, 320, 205, 66, fur);

  // Волосы
  ellipse(ctx, 320, 160, 67, 31, "#49372e");

  eyes(ctx, 320, 204, 36);

  line(ctx, 300, 235, 340, 235, "#8e4e40", 3);

  line(ctx, 260, 300, 200, 355, "#3974b8", 23);
  line(ctx, 380, 300, 440, 355, "#3974b8", 23);

  line(ctx, 280, 390, 275, 435, "#303b58", 26);
  line(ctx, 360, 390, 365, 435, "#303b58", 26);
}

function drawBurger(ctx) {
  ctx.fillStyle = "#f6e7c8";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#d7b07a";
  ctx.fillRect(0, 340, W, 140);

  ellipse(ctx, 320, 318, 168, 46, "#e2a04a");
  ellipse(ctx, 320, 292, 160, 20, "#6b3e26");
  ellipse(ctx, 320, 274, 166, 14, "#f2c14e");
  ellipse(ctx, 320, 260, 154, 16, "#67b35a");
  ellipse(ctx, 320, 214, 170, 58, "#e7b15a");
  ellipse(ctx, 320, 176, 128, 26, "#f0c36a");

  circle(ctx, 250, 168, 7, "#f7f0d8");
  circle(ctx, 300, 156, 7, "#f7f0d8");
  circle(ctx, 348, 160, 7, "#f7f0d8");
  circle(ctx, 392, 174, 6, "#f7f0d8");
}

function drawLandscape(ctx, rnd) {
  ctx.fillStyle = "#b9e2ff";
  ctx.fillRect(0, 0, W, H);

  circle(ctx, 505, 90, 43, "#ffe58f");

  polygon(ctx, [
    [0, 320], [130, 130], [260, 320]
  ], "#8bb4d4");

  polygon(ctx, [
    [170, 330], [365, 100], [560, 330]
  ], "#6d94b7");

  polygon(ctx, [
    [310, 170], [365, 100], [420, 170]
  ], "#ffffff");

  ground(ctx, "#8fcf88");

  for (let i = 0; i < 20; i++) {
    circle(ctx, rnd() * W, 370 + rnd() * 80, 3 + rnd() * 5, "#5eaa60");
  }
}

function drawScene(ctx, theme, rnd) {
  background(ctx, theme.bg);

  switch (theme.id) {
    case "beaver":
      drawBeaver(ctx);
      break;
    case "cat":
      drawCat(ctx, theme.fur);
      break;
    case "dog":
      drawDog(ctx, theme.fur);
      break;
    case "rabbit":
      drawRabbit(ctx, theme.fur);
      break;
    case "fox":
      drawFox(ctx, theme.fur);
      break;
    case "bear":
      drawBear(ctx, theme.fur);
      break;
    case "bird":
      drawBird(ctx, theme.fur);
      break;
    case "fish":
      drawFish(ctx, theme.fur);
      break;
    case "lion":
      drawLion(ctx, theme.fur);
      break;
    case "elephant":
      drawElephant(ctx, theme.fur);
      break;
    case "frog":
      drawFrog(ctx, theme.fur);
      break;
    case "butterfly":
      drawButterfly(ctx, theme.fur);
      break;
    case "horse":
      drawHorse(ctx, theme.fur);
      break;
    case "flower":
      drawFlower(ctx, theme.fur);
      break;
    case "tree":
      drawTree(ctx, theme.fur);
      break;
    case "house":
      drawHouse(ctx, theme.fur);
      break;
    case "car":
      drawCar(ctx, theme.fur);
      break;
    case "footballer":
      drawFootballer(ctx, theme.fur);
      break;
    case "football":
      drawFootball(ctx);
      break;
    case "space":
      drawSpace(ctx, rnd);
      break;
    case "sea":
      drawSea(ctx);
      break;
    case "sunset":
      drawSunset(ctx);
      break;
    case "robot":
      drawRobot(ctx, theme.fur);
      break;
    case "person":
      drawPerson(ctx, theme.fur);
      break;
    case "burger":
      drawBurger(ctx);
      break;
    default:
      drawLandscape(ctx, rnd);
  }

  // Подпись
  ctx.fillStyle = "rgba(0,0,0,0.48)";
  ctx.fillRect(0, H - 34, W, 34);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Pupik AI · локальный рисунок", 14, H - 12);
}

function loadImage(src, cors = false) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(ctx, img, x, y, width, height) {
  const imageRatio = img.width / img.height;
  const boxRatio = width / height;

  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imageRatio > boxRatio) {
    sw = img.height * boxRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxRatio;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, width, height);
}

export function wantsCollage(text) {
  const p = normalize(text);

  return /сделай\s+меня|нарисуй\s+меня|добавь\s+меня|меня\s+с\s+|with\s+me|me\s+with|make\s+me\s+with|photo\s+with/.test(p);
}

export function wantsImage(text) {
  const p = normalize(text);

  return (
    wantsCollage(p) ||
    /нарисуй|нарисовать|сгенер|генерируй|создай\s+(картин|изображен|фото)|сделай\s+(картин|изображен|фото)|draw\b|generate\b.*\b(image|picture|photo)|картинк|изображение|фотографию/.test(p)
  );
}

export function extractImagePrompt(text) {
  const p = String(text || "").trim();

  const match = p.match(
    /(?:нарисуй|нарисовать|сгенерируй|сгенерировать|создай|сделай)\s+(?:(?:мне)\s+)?(?:(?:картинку|изображение|фото|рисунок)\s*)?(?:про\s+|с\s+|of\s+)?(.+)/i
  );

  if (match && match[1]) {
    return match[1].trim();
  }

  return p || "пейзаж";
}

/**
 * @param {string} prompt
 * @param {{ photoDataUrl?: string }} [opts]
 */
const PHOTO_QUERIES = [
  [/роналд|криштиан|cr7/, "Cristiano Ronaldo", "Криштиану Роналду"],
  [/месси|messi/, "Lionel Messi", "Месси"],
  [/бургер|гамбургер|чизбургер|burger/, "hamburger", "бургер"],
  [/кот|кошк|котен|kitten|\bcat\b/, "cat", "кот"],
  [/собак|щенок|puppy|\bdog\b/, "dog", "собака"],
  [/кролик|заяц|bunny|rabbit/, "rabbit", "кролик"],
  [/лиса|лису|лисы|\bfox\b/, "fox", "лиса"],
  [/медвед|bear/, "bear", "медведь"],
  [/птиц|попуга|сова|bird/, "bird", "птица"],
  [/рыб|акул|fish/, "fish", "рыба"],
  [/лев|lion/, "lion", "лев"],
  [/слон|elephant/, "elephant", "слон"],
  [/лягуш|frog/, "frog", "лягушка"],
  [/бабоч|butterfly/, "butterfly", "бабочка"],
  [/лошад|конь|horse/, "horse", "лошадь"],
  [/цвет|роза|flower/, "flower", "цветок"],
  [/дерев|forest|tree/, "tree", "дерево"],
  [/дом|house/, "house", "дом"],
  [/машин|автомобил|car/, "car", "машина"],
  [/футбол|мяч|soccer|football/, "football", "футбол"],
  [/космос|луна|планет|space/, "space", "космос"],
  [/море|океан|пляж|beach|ocean/, "sea", "море"],
  [/закат|солнц|sunset/, "sunset", "закат"],
  [/робот|robot/, "robot", "робот"],
  [/человек|person/, "person", "человек"]
];

export function photoSubjects(prompt) {
  const p = normalize(prompt);
  const found = [];
  for (const [pattern, query, label] of PHOTO_QUERIES) {
    const match = p.match(pattern);
    if (!match || found.some(item => item.query === query)) continue;
    found.push({ query, label, at: match.index, known: true });
  }
  found.sort((a, b) => a.at - b.at);
  if (found.length) return found.slice(0, 3);
  const rest = p.replace(/нарисуй|картинк\w*|фото\w*|рисунок\w*/g, "").trim();
  return rest ? [{ query: rest, label: rest, at: 0, known: false }] : [{ query: "landscape", label: "пейзаж", at: 0, known: false }];
}

const PHOTO_VARIANTS = {
  "Cristiano Ronaldo": [
    "Cristiano Ronaldo Portugal",
    "Cristiano Ronaldo Real Madrid",
    "Cristiano Ronaldo Manchester United",
    "Cristiano Ronaldo Juventus",
    "Cristiano Ronaldo Al Nassr",
    "CR7 football"
  ],
  cat: ["cat", "kitten", "tabby cat", "cat portrait", "cat playing"],
  dog: ["dog", "puppy", "dog portrait", "dog running"],
  hamburger: ["hamburger", "cheeseburger", "burger food"]
};

const seenPhotos = [];

function photoTurn() {
  try {
    const next = Number(sessionStorage.getItem("pupik_photo_turn") || "0") + 1;
    sessionStorage.setItem("pupik_photo_turn", String(next));
    return next;
  } catch {
    return seenPhotos.length + 1;
  }
}

function searchTerms(query, turn, extra) {
  const variants = PHOTO_VARIANTS[query] || [query, `${query} portrait`, `${query} close`];
  const term = variants[turn % variants.length];
  return extra ? `${term} ${extra}` : term;
}

async function findPhoto(query, turn = 0, extra = "") {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: `${searchTerms(query, turn, extra)} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "20",
    prop: "imageinfo",
    iiprop: "url|mime",
    iiurlwidth: "800"
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!response.ok) throw new Error("commons");
  const data = await response.json();
  const pages = Object.values(data.query?.pages || {});
  const skip = /escultura|statue|sculpture|logo|icon|map|flag|diagram|drawing|sketch|svg|coat of arms|monument|museum|museu|hotel/i;
  const photos = pages
    .map(page => ({
      title: page.title || "",
      info: page.imageinfo?.[0]
    }))
    .filter(item => item.info && /jpeg|png|webp/.test(item.info.mime || "") && (item.info.thumburl || item.info.url) && !skip.test(item.title));
  if (!photos.length) throw new Error("no photo");
  const fresh = photos.filter(item => !seenPhotos.includes(item.info.thumburl || item.info.url));
  const pool = fresh.length ? fresh : photos;
  const photo = pool[turn % pool.length];
  const url = photo.info.thumburl || photo.info.url;
  seenPhotos.push(url);
  if (seenPhotos.length > 40) seenPhotos.shift();
  return url;
}

async function collage(urls) {
  const images = [];
  for (const url of urls) {
    images.push(await loadImage(url, true));
  }
  const canvas = document.createElement("canvas");
  const width = Math.round(960 / images.length);
  canvas.width = width * images.length;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");
  images.forEach((img, index) => {
    drawCover(ctx, img, index * width, 0, width, canvas.height);
  });
  return canvas.toDataURL("image/jpeg", 0.86);
}

export async function generateImage(prompt) {
  const subjects = photoSubjects(prompt);
  const turn = photoTurn();
  const number = (normalize(prompt).match(/(?:номер|number|№)\s*(\d{1,2})/) || [])[1] || "";
  const urls = [];
  for (const subject of subjects) {
    const extra = number && /Ronaldo|Messi/.test(subject.query) ? number : "";
    try {
      urls.push(await findPhoto(subject.query, turn, extra));
    } catch (error) {
      console.warn("Фото не найдено:", subject.query, error);
    }
  }
  if (!urls.length) throw new Error("no photo");
  if (urls.length === 1) return { dataUrl: urls[0], theme: "photo" };
  try {
    return { dataUrl: await collage(urls), theme: "photo" };
  } catch (error) {
    console.warn("Коллаж не собрался:", error);
    return { dataUrl: urls[0], theme: "photo" };
  }
}