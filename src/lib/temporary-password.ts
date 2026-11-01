import { randomInt } from "node:crypto";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const NUMBERS = "23456789";
const SYMBOLS = "!@#$%&*?";
const ALL = LETTERS + NUMBERS + SYMBOLS;

/** A fresh, unpredictable password for one account. Never persist or log the plaintext. */
export function generateTemporaryPassword() {
  const characters = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ"[randomInt(24)],
    "abcdefghijkmnopqrstuvwxyz"[randomInt(25)],
    NUMBERS[randomInt(NUMBERS.length)],
    SYMBOLS[randomInt(SYMBOLS.length)],
  ];
  while (characters.length < 20) characters.push(ALL[randomInt(ALL.length)]);
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [characters[index], characters[swap]] = [characters[swap], characters[index]];
  }
  return characters.join("");
}
