import type { LegacyRollData } from "@dice-roller/convertor";

// A fixed v5 export of 2d6; no dice are rolled when loading the example.
export const legacyExample: LegacyRollData = {
  type: "dice-roll",
  notation: "2d6",
  rolls: [
    {
      type: "roll-results",
      rolls: [2, 5].map((value) => ({
        type: "result",
        initialValue: value,
        value,
        calculationValue: value,
        useInTotal: true,
        modifiers: [],
        modifierFlags: "",
      })),
      value: 7,
    },
  ],
  output: "2d6: [2, 5] = 7",
  total: 7,
  minTotal: 2,
  maxTotal: 12,
  averageTotal: 7,
};
