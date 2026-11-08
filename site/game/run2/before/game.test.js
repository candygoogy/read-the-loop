const test = require("node:test");
const assert = require("node:assert/strict");
const { HEIGHT, WIDTH, createState, step } = require("./game.js");

const FRAME = 1 / 60;

test("ball bounces off the left wall", () => {
  const state = createState();
  Object.assign(state.ball, { x: 8, y: 200, vx: -240, vy: 0 });
  step(state, FRAME);
  assert.ok(state.ball.vx > 0);
  assert.ok(state.ball.x >= state.ball.radius);
});

test("hitting a brick breaks it and scores", () => {
  const state = createState();
  const brick = state.bricks[state.bricks.length - 1];
  Object.assign(state.ball, {
    x: brick.x + brick.width / 2,
    y: brick.y + brick.height + state.ball.radius + 1,
    vx: 0,
    vy: -240,
  });
  step(state, FRAME);
  assert.equal(brick.alive, false);
  assert.equal(state.score, 10);
  assert.ok(state.ball.vy > 0);
});

function dropOntoPaddle(state, x) {
  Object.assign(state.ball, { x, y: state.paddle.y - state.ball.radius - 1, vx: 0, vy: 240 });
  step(state, FRAME);
}

test("ball landing on the middle of the paddle bounces up", () => {
  const state = createState();
  const { paddle } = state;
  dropOntoPaddle(state, paddle.x + paddle.width / 2);
  assert.ok(state.ball.vy < 0);
});

test("ball landing on the right half of the paddle bounces up", () => {
  const state = createState();
  const { paddle } = state;
  dropOntoPaddle(state, paddle.x + paddle.width * 0.75);
  assert.ok(state.ball.vy < 0);
  assert.ok(state.ball.vx > 0);
});

test("a missed ball is served again from the centre", () => {
  const state = createState();
  Object.assign(state.ball, { x: 30, y: HEIGHT + 10, vx: 0, vy: 240 });
  step(state, FRAME);
  assert.equal(state.ball.x, WIDTH / 2);
  assert.equal(state.ball.y, HEIGHT / 2);
  assert.ok(state.ball.vy > 0);
});
