// Shared tuning constants and arena geometry.

export const CUBELET = 3.5; // edge length of one cubelet — change this to resize the whole arena
export const GRID = [-CUBELET, 0, CUBELET]; // cubelet center coordinates per axis
export const HALF = CUBELET * 1.5; // half-extent of the whole cube -> top face is the [-HALF,HALF] square
export const TOP_Y = HALF; // y of the top walking surface

export const PLAYER_RADIUS = 0.45;
export const GROUND_Y = TOP_Y + PLAYER_RADIUS;
export const FALL_DEATH_Y = -4; // below this the run ends

// Movement feel
export const MOVE_SPEED = 8.5;
export const ACCEL = 60;
export const AIR_ACCEL = 22;
export const FRICTION = 50;
export const GRAVITY = 28;
export const JUMP_VELOCITY = 10;
export const COYOTE_TIME = 0.12;
export const JUMP_BUFFER = 0.12;

export const DASH_SPEED = 22;
export const DASH_TIME = 0.16;
export const DASH_COOLDOWN = 1.4;

// Neon palette
export const COLORS = {
  cyan: 0x2ff3ff,
  pink: 0xff3ca6,
  green: 0x5dff8b,
  yellow: 0xffe14d,
  red: 0xff4d5e,
  purple: 0xb15dff,
  orange: 0xff9a3c,
};

// Tile danger states
export enum TileState {
  Safe,
  Warn, // yellow
  Danger, // red, about to rotate
}
