import { describe, expect, it } from "vitest";
import { isOffTopic } from "./scope.js";

describe("coach topic guard", () => {
  it.each([
    "Write a python program to reverse a linked list",
    "solve this leetcode problem: two sum",
    "explain binary search tree time complexity",
    "what is dynamic programming in DSA",
    "Can you debug my JavaScript code?",
    "write an essay on climate change",
    "help me with my maths homework",
    "which stock should I invest in",
    "write a cover letter for a software job",
    "SQL query to find second highest salary",
  ])("blocks: %s", (message) => {
    expect(isOffTopic(message)).toBe(true);
  });

  it.each([
    "How much protein should I eat?",
    "I drank 500 ml of water",
    "Write me a workout program for 3 days a week",
    "my knee hurts when I squat",
    "is creatine safe?",
    "plan my 5k training",
    "I code all day and my back hurts, any stretches?",
    "how many calories in 2 roti and dal",
    "kya main raat ko rice kha sakta hoon",
    "hello",
    "How am I doing today?",
    "what should I eat before an exam to stay focused",
  ])("lets through: %s", (message) => {
    expect(isOffTopic(message)).toBe(false);
  });
});
