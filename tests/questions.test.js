import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const questions = JSON.parse(readFileSync(new URL("../shared/questions.json", import.meta.url), "utf8"));

test("question bank contains at least one hundred unique bilingual prompts", () => {
  assert.ok(questions.length >= 100, `expected at least 100 prompts, got ${questions.length}`);
  assert.equal(new Set(questions.map((question) => question.it)).size, questions.length);
  assert.equal(new Set(questions.map((question) => question.en)).size, questions.length);

  for (const question of questions) {
    assert.equal(typeof question.it, "string");
    assert.equal(typeof question.en, "string");
    assert.ok(question.it.trim().length > 0);
    assert.ok(question.en.trim().length > 0);
  }
});
