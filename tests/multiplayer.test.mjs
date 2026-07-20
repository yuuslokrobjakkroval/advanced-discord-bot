import assert from "node:assert/strict";
import test from "node:test";
import { winningPlayer } from "../dist/services/multiplayer.js";

test("tic-tac-toe detects horizontal, vertical and diagonal wins", () => {
  assert.equal(winningPlayer([1, 1, 1, 0, 2, 0, 2, 0, 0], "tic-tac-toe"), 1);
  assert.equal(winningPlayer([2, 1, 0, 2, 1, 0, 2, 0, 0], "tic-tac-toe"), 2);
  assert.equal(winningPlayer([1, 2, 0, 2, 1, 0, 0, 0, 1], "tic-tac-toe"), 1);
  assert.equal(winningPlayer([1, 2, 1, 2, 1, 2, 2, 1, 2], "tic-tac-toe"), 0);
});

test("connect-4 detects horizontal, vertical and diagonal wins", () => {
  const horizontal = Array(42).fill(0);
  [35, 36, 37, 38].forEach((index) => horizontal[index] = 1);
  assert.equal(winningPlayer(horizontal, "connect-4"), 1);

  const vertical = Array(42).fill(0);
  [14, 21, 28, 35].forEach((index) => vertical[index] = 2);
  assert.equal(winningPlayer(vertical, "connect-4"), 2);

  const diagonal = Array(42).fill(0);
  [14, 22, 30, 38].forEach((index) => diagonal[index] = 1);
  assert.equal(winningPlayer(diagonal, "connect-4"), 1);
});
