type FieldBase = {
  key: string;
  label: string;
  description?: string;
  disabledWhen?: { key: string; equals: boolean };
};

export type PresenterOptionField =
  | (FieldBase & { type: "boolean" | "string" | "colour" })
  | (FieldBase & { type: "number"; minimum: number; maximum?: number })
  | (FieldBase & {
      type: "select";
      items: { label: string; value: string }[];
    })
  | {
      type: "group";
      key?: string;
      label: string;
      description?: string;
      collapsible?: boolean;
      fields: PresenterOptionField[];
    };

const flagLabels = {
  compound: "Compound",
  explode: "Explode",
  "explode-matching-batch": "Matching batch explode",
  "explode-matching-batch-failure": "Matching batch failure",
  "critical-failure": "Critical failure",
  "critical-success": "Critical success",
  drop: "Drop",
  max: "Maximum",
  min: "Minimum",
  penetrate: "Penetrate",
  "re-roll": "Reroll",
  "re-roll-once": "Reroll once",
  "target-failure": "Target failure",
  "target-success": "Target success",
  unique: "Unique",
  "unique-once": "Unique once",
};

export const presenterDefinitions = {
  Text: {
    stateKey: "textOptions",
    documentationPath: "guide/customisation/presenters/text.html",
    fields: [
      {
        key: "expandInlineRolls",
        label: "Expand inline rolls",
        type: "boolean",
        description:
          "Show rolls used to calculate quantities, sides and modifier counts.",
      },
      {
        key: "separator",
        label: "History separator",
        type: "string",
        description: "Text between rolls in a history.",
      },
      {
        key: "flagSymbols",
        label: "Flag symbols",
        type: "group",
        collapsible: true,
        description: "Leave a symbol empty to hide it.",
        fields: Object.entries(flagLabels).map(([key, label]) => ({
          key,
          label,
          type: "string",
        })),
      },
    ] satisfies PresenterOptionField[],
  },
  SVG: {
    stateKey: "svgOptions",
    documentationPath: "guide/customisation/presenters/svg.html",
    fields: [
      {
        key: "size",
        label: "Dice size",
        type: "number",
        minimum: 20,
        maximum: 400,
      },
      {
        key: "width",
        label: "Drawing width",
        type: "number",
        minimum: 49,
        description: "Width in SVG drawing units.",
        disabledWhen: { key: "noWrap", equals: true },
      },
      { key: "noWrap", label: "Keep on one line", type: "boolean" },
      { key: "stroke", label: "Stroke colour", type: "colour" },
      { key: "filled", label: "Fill dice", type: "boolean" },
      {
        key: "fill",
        label: "Fill colour",
        type: "colour",
        disabledWhen: { key: "filled", equals: false },
      },
      {
        key: "modifierIconPosition",
        label: "Modifier icon position",
        type: "select",
        items: [
          { label: "Corner", value: "corner" },
          { label: "Below", value: "below" },
        ],
        disabledWhen: { key: "showModifierIcons", equals: false },
      },
      {
        type: "group",
        label: "Show",
        fields: [
          { key: "showValues", label: "Dice values", type: "boolean" },
          { key: "showDescriptions", label: "Descriptions", type: "boolean" },
          { key: "showDiceLabels", label: "Dice labels", type: "boolean" },
          {
            key: "showVariableLabels",
            label: "Variable labels",
            type: "boolean",
          },
          {
            key: "showModifierLabels",
            label: "Modifier labels",
            type: "boolean",
          },
          {
            key: "showModifierIcons",
            label: "Modifier icons",
            type: "boolean",
          },
          { key: "showNotation", label: "Notation", type: "boolean" },
          { key: "showTotals", label: "Totals", type: "boolean" },
        ],
      },
    ] satisfies PresenterOptionField[],
  },
} as const;
