const WIDTH = 480;
const HEIGHT = 320;

const BALL_RADIUS = 6;
const SERVE = { vx: 40, vy: 240 };
const PADDLE_SPEED = 360;
const MAX_BOUNCE_ANGLE = Math.PI / 3;

const BRICK_ROWS = 3;
const BRICK_COLS = 8;
const BRICK_WIDTH = 50;
const BRICK_HEIGHT = 14;
const BRICK_GAP = 6;
const BRICK_TOP = 40;

const LIGHT = { paper: "#f3ede2", ink: "#1f1b16", accent: "#c8432b", bricks: ["#2c7a6f", "#c4841a", "#6b7a8c"] };
const DARK = { paper: "#17150f", ink: "#eee6d6", accent: "#ef6a4f", bricks: ["#4fb3a4", "#e3a640", "#93a3b6"] };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeBricks() {
  const rowWidth = BRICK_COLS * BRICK_WIDTH + (BRICK_COLS - 1) * BRICK_GAP;
  const left = (WIDTH - rowWidth) / 2;
  const bricks = [];
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      const x = left + col * (BRICK_WIDTH + BRICK_GAP);
      const y = BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP);
      bricks.push({ x, y, width: BRICK_WIDTH, height: BRICK_HEIGHT, row, alive: true });
    }
  }
  return bricks;
}

function serve(ball) {
  ball.x = WIDTH / 2;
  ball.y = HEIGHT / 2;
  ball.vx = SERVE.vx;
  ball.vy = SERVE.vy;
}

function createState() {
  const ball = { x: 0, y: 0, vx: 0, vy: 0, radius: BALL_RADIUS };
  serve(ball);
  const paddle = { x: 0, y: HEIGHT - 24, width: 80, height: 10 };
  paddle.x = (WIDTH - paddle.width) / 2;
  return { ball, paddle, bricks: makeBricks(), score: 0 };
}

function setPaddleCentre(state, x) {
  const paddle = state.paddle;
  paddle.x = clamp(x - paddle.width / 2, 0, WIDTH - paddle.width);
}

function movePaddle(state, direction, dt) {
  const paddle = state.paddle;
  paddle.x = clamp(paddle.x + direction * PADDLE_SPEED * dt, 0, WIDTH - paddle.width);
}

function circleHitsRect(ball, rect) {
  const nearestX = clamp(ball.x, rect.x, rect.x + rect.width);
  const nearestY = clamp(ball.y, rect.y, rect.y + rect.height);
  const dx = ball.x - nearestX;
  const dy = ball.y - nearestY;
  return dx * dx + dy * dy < ball.radius * ball.radius;
}

function hitsPaddle(ball, paddle) {
  if (ball.vy <= 0) return false;
  const level = ball.y + ball.radius >= paddle.y && ball.y - ball.radius <= paddle.y + paddle.height;
  const centre = paddle.x + paddle.width / 2;
  return level && Math.abs(ball.x - centre) < paddle.width / 2 + ball.radius;
}

function bounceOffPaddle(ball, paddle) {
  const centre = paddle.x + paddle.width / 2;
  const offset = clamp((ball.x - centre) / (paddle.width / 2), -1, 1);
  const speed = Math.hypot(ball.vx, ball.vy);
  const angle = offset * MAX_BOUNCE_ANGLE;
  ball.vx = speed * Math.sin(angle);
  ball.vy = -speed * Math.cos(angle);
  ball.y = paddle.y - ball.radius;
}

function bounceOffBrick(ball, brick) {
  const overlapX = Math.min(ball.x + ball.radius - brick.x, brick.x + brick.width - (ball.x - ball.radius));
  const overlapY = Math.min(ball.y + ball.radius - brick.y, brick.y + brick.height - (ball.y - ball.radius));
  if (overlapX < overlapY) ball.vx = -ball.vx;
  else ball.vy = -ball.vy;
}

function step(state, dt) {
  const { ball, paddle } = state;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x + ball.radius > WIDTH) {
    ball.x = WIDTH - ball.radius;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.vy = Math.abs(ball.vy);
  }

  const brick = state.bricks.find((b) => b.alive && circleHitsRect(ball, b));
  if (brick) {
    brick.alive = false;
    state.score += 10;
    bounceOffBrick(ball, brick);
    if (state.bricks.every((b) => !b.alive)) state.bricks = makeBricks();
  }

  if (hitsPaddle(ball, paddle)) bounceOffPaddle(ball, paddle);

  if (ball.y - ball.radius > HEIGHT) serve(ball);
  return state;
}

function draw(ctx, state, colours) {
  ctx.fillStyle = colours.paper;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    ctx.fillStyle = colours.bricks[brick.row % colours.bricks.length];
    ctx.fillRect(brick.x, brick.y, brick.width, brick.height);
  }

  const { ball, paddle } = state;
  ctx.fillStyle = colours.accent;
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colours.ink;
  ctx.font = "14px ui-monospace, Menlo, Consolas, monospace";
  ctx.textBaseline = "top";
  ctx.fillText("Score " + state.score, 12, 12);
}

function start(canvas) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = WIDTH * dpr;
  canvas.height = HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas.style.touchAction = "none";
  if (!canvas.hasAttribute("tabindex")) canvas.tabIndex = 0;

  const darkMode = window.matchMedia("(prefers-color-scheme: dark)");
  const state = createState();
  const keys = { left: false, right: false };
  let last = null;
  let frame = 0;

  function onPointer(event) {
    const rect = canvas.getBoundingClientRect();
    setPaddleCentre(state, ((event.clientX - rect.left) / rect.width) * WIDTH);
  }

  function onKey(event) {
    const down = event.type === "keydown";
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") keys.left = down;
    else if (key === "arrowright" || key === "d") keys.right = down;
    else return;
    event.preventDefault();
  }

  function onBlur() {
    keys.left = keys.right = false;
  }

  function tick(time) {
    const dt = last === null ? 0 : Math.min((time - last) / 1000, 1 / 30);
    last = time;
    movePaddle(state, (keys.right ? 1 : 0) - (keys.left ? 1 : 0), dt);
    step(state, dt);
    draw(ctx, state, darkMode.matches ? DARK : LIGHT);
    frame = requestAnimationFrame(tick);
  }

  const listeners = [["pointermove", onPointer], ["pointerdown", onPointer], ["keydown", onKey], ["keyup", onKey], ["blur", onBlur]];
  for (const [type, fn] of listeners) canvas.addEventListener(type, fn);
  frame = requestAnimationFrame(tick);

  return {
    stop() {
      cancelAnimationFrame(frame);
      for (const [type, fn] of listeners) canvas.removeEventListener(type, fn);
    },
  };
}

if (typeof module !== "undefined") {
  module.exports = { WIDTH, HEIGHT, createState, step, setPaddleCentre, movePaddle, circleHitsRect, hitsPaddle };
}
