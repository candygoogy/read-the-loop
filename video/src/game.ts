// The real game, before and after the agent's edit. Both files are imported as text, byte for byte, from
// site/game/run2/ and run as they are: the file exports createState and step through module.exports, and the
// one line appended below also hands back its own draw() and LIGHT colours, which the file defines but doesn't
// export. Nothing in the game's logic is changed.
import beforeSrc from "../../site/game/run2/before/game.js?raw";
import afterSrc from "../../site/game/run2/after/game.js?raw";

export type Ball = { x: number; y: number; vx: number; vy: number; radius: number };
export type Paddle = { x: number; y: number; width: number; height: number };
export type State = { ball: Ball; paddle: Paddle; bricks: unknown[]; score: number };
type Colours = Record<string, unknown>;

export type Game = {
  WIDTH: number;
  HEIGHT: number;
  createState: () => State;
  step: (state: State, dt: number) => State;
  draw: (ctx: CanvasRenderingContext2D, state: State, colours: Colours) => void;
  LIGHT: Colours;
};

const load = (src: string): Game => {
  const module = { exports: {} as Record<string, unknown> };
  // eslint-disable-next-line no-new-func
  const own = new Function("module", `${src}\n;return { draw, LIGHT };`)(module) as Pick<Game, "draw" | "LIGHT">;
  return { ...(module.exports as Omit<Game, "draw" | "LIGHT">), ...own };
};

export const games = { before: load(beforeSrc), after: load(afterSrc) };
export type Version = keyof typeof games;

// One step per video frame. 1/30 s is also the longest step the game itself takes (its tick caps dt there).
export const DT = 1 / 30;

const cache: Partial<Record<Version, State[]>> = {};

/**
 * The game state after each frame, from a fresh createState(). The paddle is never moved, so it stays at its
 * starting centre. Deterministic: the same frame always gives the same state.
 */
export const simulate = (version: Version, frames: number): State[] => {
  const have = cache[version];
  if (have && have.length > frames) return have;
  const game = games[version];
  const state = game.createState();
  const out: State[] = [structuredClone(state)];
  for (let f = 1; f <= frames; f++) {
    game.step(state, DT);
    out.push(structuredClone(state));
  }
  cache[version] = out;
  return out;
};
