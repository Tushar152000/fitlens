import { parseRules } from "@fitr8/domain/reminders";
import { describe, expect, it } from "vitest";
import { mockReminderDraft } from "./mock.extractor.js";

/** The offline stand-in must turn everyday phrasing into rules the domain accepts. */
describe("mockReminderDraft", () => {
  const cases: [string, string, string[]][] = [
    [
      "remind me to brush 9 am in the first of the month and the second last evening of the month 6pm",
      "Brush",
      ["0 9 1 * *", "0 18 L-1 * *"],
    ],
    ["Take creatine every once every month", "Take creatine", ["0 9 1 * *"]],
    ["Remind me to take creatine every day at 9 am", "Take creatine", ["0 9 * * *"]],
    ["stretch on weekdays at 6:30 pm", "Stretch", ["30 18 * * 1-5"]],
    ["Drink water every 2 hours", "Drink water", ["0 9-21/2 * * *"]],
    ["Weigh in every Monday at 7 am", "Weigh in", ["0 7 * * 1"]],
    ["pay gym fee on the 5th", "Pay gym fee", ["0 9 5 * *"]],
    ["check body fat on the last day of the month at 8 pm", "Check body fat", ["0 20 L * *"]],
    ["meal prep on the first sunday of the month", "Meal prep", ["0 9 * * 0#1"]],
    ["walk at 7 am on weekdays and 8 am on weekends", "Walk", ["0 7 * * 1-5", "0 8 * * 0,6"]],
    // The example chips on the Reminders screen must all work offline too.
    ["Weigh in on the 1st and last day of the month", "Weigh in", ["0 9 1 * *", "0 9 L * *"]],
  ];

  it.each(cases)("%s", (text, title, crons) => {
    const draft = mockReminderDraft(text);
    expect(draft).toMatchObject({ isReminder: true, title, crons });
    expect(parseRules(draft.crons).ok).toBe(true);
  });

  it("says no to text that isn't a reminder", () => {
    expect(mockReminderDraft("hello there").isReminder).toBe(false);
  });
});
