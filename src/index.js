const SUITS = [
  { key: "spade",  symbol: "♠", color: 0x0e0e10 },
  { key: "heart",  symbol: "♥", color: 0xc1121f },
  { key: "diamond",symbol: "♦", color: 0xdc2626 },
  { key: "club",   symbol: "♣", color: 0x0e0e10 },
];

const RANKS = ["A", "2", "3", "4"]; // 4 per suit => 16 total

// Layout constants
const GRID_COLS = 4;
const GRID_ROWS = 4;
const CARD_W = 140;
const CARD_H = 200;
const GAP_X = 24;
const GAP_Y = 24;
const BOARD_PAD_TOP = 120;

let app;
let stage, board;
let hud = {};
let gameState;

async function init() {
  app = new PIXI.Application();
  await app.init({
    background: "#0f1117",
    resizeTo: window,
    antialias: true,
    preference: "webgl",
  });

  document.body.appendChild(app.canvas);

  stage = app.stage;
  board = new PIXI.Container();
  stage.addChild(board);

  createHUD();
  newGame();

  window.addEventListener("resize", layout);
  layout();
}

function newGame() {
  // Remove previous board children (if any)
  board.removeChildren();

  // Reset state
  gameState = {
    deck: [],
    selected: [],
    attempts: 0,
    locked: false,
    matchedCount: 0, // count of face-up locked cards
    totalCards: GRID_COLS * GRID_ROWS,
  };

  // Build deck of {suit, rank}
  const raw = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) raw.push({ suit: suit.key, rank });
  }

  // Shuffle
  shuffle(raw);

  // Create cards
  const cards = raw.map((info, i) => createCardSprite(info));
  gameState.deck = cards;

  // Add to board & position
  cards.forEach(c => board.addChild(c));
  layoutGrid(cards);

  // Reset HUD
  hud.attempts.text = `Attempts: 0`;
  hud.status.text = `Find matching suits`;
  gsap.fromTo(hud.status, {alpha: 0}, {alpha: 1, duration: 0.6, ease: "power2.out"});
}

function createHUD() {
  // Title
  const title = new PIXI.Text({
    text: "Match Pairs",
    style: {
      fill: 0xffffff,
      fontSize: 36,
      fontWeight: "800",
      letterSpacing: 1,
      dropShadow: true,
      dropShadowAlpha: 0.35,
      dropShadowDistance: 3,
    }
  });
  stage.addChild(title);

  // Attempts
  const attempts = new PIXI.Text({
    text: "Attempts: 0",
    style: { fill: 0xb3b7c2, fontSize: 20, fontWeight: "600" }
  });
  stage.addChild(attempts);

  // Status
  const status = new PIXI.Text({
    text: "Loading…",
    style: { fill: 0x9fe870, fontSize: 20, fontWeight: "700" }
  });
  stage.addChild(status);

  // Restart button
  const restart = makeButton("Restart");
  restart.on("pointertap", () => {
    if (gameState.locked) return;
    newGame();
    pulse(hud.status);
  });
  stage.addChild(restart);

  hud.title = title;
  hud.attempts = attempts;
  hud.status = status;
  hud.restart = restart;
}

function layout() {
  // Center board and place HUD elements
  layoutGrid(gameState?.deck || []);

  const w = app.renderer.width;
  const titleX = Math.max(24, (w / 2) - 360);
  hud.title.x = titleX;
  hud.title.y = 24;

  hud.attempts.x = titleX;
  hud.attempts.y = 70;

  hud.status.x = titleX + 180;
  hud.status.y = 70;

  hud.restart.x = w - 24 - hud.restart.width;
  hud.restart.y = 24;

  // Center board horizontally
  board.y = BOARD_PAD_TOP;
  board.x = (w - board.width) / 2;
}

function layoutGrid(cards) {
  if (!cards.length) return;

  const totalW = GRID_COLS * CARD_W + (GRID_COLS - 1) * GAP_X;
  const totalH = GRID_ROWS * CARD_H + (GRID_ROWS - 1) * GAP_Y;

  // For precise centering, we’ll set board pivot and positions
  board.pivot.set(totalW / 2, totalH / 2);

  const startX = CARD_W / 2;
  const startY = CARD_H / 2;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const idx = r * GRID_COLS + c;
      const card = cards[idx];
      if (!card) continue;
      card.x = startX + c * (CARD_W + GAP_X);
      card.y = startY + r * (CARD_H + GAP_Y);
    }
  }

  // After positioning, size of board is known.
  board.width = GRID_COLS * CARD_W + (GRID_COLS - 1) * GAP_X;
  board.height = GRID_ROWS * CARD_H + (GRID_ROWS - 1) * GAP_Y;
}

function makeButton(label) {
  const padding = { x: 18, y: 10 };
  const text = new PIXI.Text({
    text: label,
    style: { fill: 0x101218, fontSize: 16, fontWeight: "800" }
  });

  const bg = new PIXI.Graphics();
  const w = text.width + padding.x * 2;
  const h = text.height + padding.y * 2;
  bg.roundRect(0, 0, w, h, 12).fill({ color: 0x9fe870 });
  const cont = new PIXI.Container();
  cont.addChild(bg);
  text.x = padding.x;
  text.y = padding.y - 1;
  cont.addChild(text);

  cont.eventMode = "static";
  cont.cursor = "pointer";
  cont.on("pointerover", () => gsap.to(cont, { scale: 1.05, duration: 0.15 }));
  cont.on("pointerout",  () => gsap.to(cont, { scale: 1.00, duration: 0.2 }));

  return cont;
}

// Card factory:
function createCardSprite({ suit, rank }) {
  const cont = new PIXI.Container();
  cont.width = CARD_W;
  cont.height = CARD_H;
  cont.pivot.set(CARD_W / 2, CARD_H / 2);
  cont.eventMode = "static";
  cont.cursor = "pointer";

  // Back
  const back = drawCardBack(CARD_W, CARD_H);
  back.name = "back";
  cont.addChild(back);

  // Face
  const face = drawCardFace(CARD_W, CARD_H, suit, rank);
  face.name = "face";
  face.visible = false;
  cont.addChild(face);

  cont.__meta = {
    suit, rank,
    matched: false,
    face, back,
    faceUp: false
  };

  cont.on("pointertap", () => onCardTap(cont));
  return cont;
}

function drawCardBack(w, h) {
  const g = new PIXI.Graphics();
  g.roundRect(0, 0, w, h, 16).fill({ color: 0x1f2937 }).stroke({ width: 3, color: 0x3b82f6, alignment: 1 });
  // pattern
  const pad = 12;
  const inner = new PIXI.Graphics();
  inner.roundRect(pad, pad, w - pad * 2, h - pad * 2, 12).fill({ color: 0x111827 }).stroke({ width: 2, color: 0x3b82f6, alignment: 1 });
  g.addChild(inner);
  return g;
}

function drawCardFace(w, h, suitKey, rank) {
  const { symbol, color } = suitFromKey(suitKey);
  const g = new PIXI.Graphics();
  g.roundRect(0, 0, w, h, 16).fill({ color: 0xf9fafb }).stroke({ width: 3, color: 0xe5e7eb, alignment: 1 });

  // Corner rank/suit
  const corner = new PIXI.Text({
    text: `${rank}\n${symbol}`,
    style: {
      fill: color,
      fontSize: 22,
      fontWeight: "800",
      align: "center"
    }
  });
  corner.x = 10; corner.y = 8;
  g.addChild(corner);

  // Big suit center
  const center = new PIXI.Text({
    text: symbol,
    style: { fill: color, fontSize: 84, fontWeight: "800" }
  });
  center.anchor.set(0.5);
  center.x = w / 2;
  center.y = h / 2 - 8;
  g.addChild(center);

  // Mirrored corner
  const corner2 = new PIXI.Text({
    text: `${symbol}\n${rank}`,
    style: {
      fill: color,
      fontSize: 22,
      fontWeight: "800",
      align: "center"
    }
  });
  corner2.anchor.set(1, 1);
  corner2.x = w - 10; corner2.y = h - 8;
  g.addChild(corner2);

  return g;
}

function suitFromKey(key) {
  const suit = SUITS.find(s => s.key === key);
  return suit ?? SUITS[0];
}

function onCardTap(card) {
  const meta = card.__meta;
  if (gameState.locked) return;
  if (meta.matched) return;
  if (meta.faceUp) return;

  flip(card, true, () => {
    gameState.selected.push(card);

    if (gameState.selected.length === 2) {
      // Lock during check
      gameState.locked = true;
      gameState.attempts++;
      updateAttempts();

      const [a, b] = gameState.selected;
      const isMatch = a.__meta.suit === b.__meta.suit;

      if (isMatch) {
        a.__meta.matched = true;
        b.__meta.matched = true;
        a.eventMode = "none";
        b.eventMode = "none";
        gameState.matchedCount += 2;

        flashStatus("Match!", 0x9fe870);
        celebratePair([a, b]);

        gameState.selected = [];
        gameState.locked = false;

        if (gameState.matchedCount >= gameState.totalCards) {
          onWin();
        }
      } else {
        flashStatus("No match", 0xf97316);
        // Flip back after a short pause
        gsap.delayedCall(0.7, () => {
          flip(a, false);
          flip(b, false, () => {
            gameState.selected = [];
            gameState.locked = false;
          });
        });
      }
    }
  });
}

function updateAttempts() {
  hud.attempts.text = `Attempts: ${gameState.attempts}`;
  pulse(hud.attempts);
}

function pulse(displayObject) {
  gsap.fromTo(displayObject, { scale: 1.0 }, { scale: 1.08, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.out" });
}

function flashStatus(txt, colorHex) {
  hud.status.style.fill = colorHex;
  hud.status.text = txt;
  gsap.fromTo(hud.status, { alpha: 0 }, { alpha: 1, duration: 0.25 });
  gsap.to(hud.status, { alpha: 0.65, duration: 0.6, delay: 0.5 });
}

// Card flip animation using scaleX trick
function flip(card, toFace, onComplete) {
  const meta = card.__meta;
  gsap.to(card.scale, {
    x: 0,
    duration: 0.14,
    ease: "power2.in",
    onComplete: () => {
      meta.face.visible = toFace;
      meta.back.visible = !toFace;
      meta.faceUp = toFace;
      gsap.to(card.scale, {
        x: 1,
        duration: 0.18,
        ease: "power2.out",
        onComplete
      });
    }
  });
}

function celebratePair(cards) {
  // Subtle pop
  cards.forEach(c => {
    gsap.fromTo(c, { scale: 1 }, { scale: 1.1, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.out" });
    glow(c, 0x9fe870);
  });
}

function glow(card, color) {
  // Simple fake glow via an expanding ring
  const ring = new PIXI.Graphics();
  ring.circle(0, 0, Math.max(CARD_W, CARD_H) * 0.6).stroke({ color, width: 6, alpha: 0.9 });
  ring.alpha = 0;
  ring.x = card.x;
  ring.y = card.y;
  board.addChild(ring);
  gsap.to(ring, { alpha: 1, duration: 0.12 });
  gsap.to(ring.scale, { x: 1.2, y: 1.2, duration: 0.35, ease: "power2.out" });
  gsap.to(ring, { alpha: 0, duration: 0.25, delay: 0.25, onComplete: () => ring.destroy() });
}

function onWin() {
  hud.status.style.fill = 0x9fe870;
  hud.status.text = "You Win! 🎉";
  gsap.fromTo(hud.status, { scale: 1 }, { scale: 1.15, duration: 0.25, ease: "back.out(2)" });

  // Confetti-ish particles
  spawnConfetti();
}

function spawnConfetti() {
  const w = board.width;
  const h = board.height;
  const count = 40;

  for (let i = 0; i < count; i++) {
    const piece = new PIXI.Graphics();
    const size = 6 + Math.random() * 10;
    const x = (Math.random() * w) - w/2;
    const y = -h/2 - 20 - Math.random() * 60;
    piece.rect(-size/2, -size/2, size, size).fill({ color: randChoice([0x22c55e, 0x84cc16, 0xf59e0b, 0x60a5fa, 0xf472b6]) });
    piece.x = x; piece.y = y;
    board.addChild(piece);

    gsap.to(piece, {
      y: h/2 + 40 + Math.random() * 60,
      rotation: Math.random() * Math.PI * 4,
      duration: 0.9 + Math.random() * 0.8,
      ease: "bounce.out",
      onComplete: () => piece.destroy()
    });
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function randChoice(list) {
  return list[(Math.random() * list.length) | 0];
}

// Boot
init().catch(console.error);
