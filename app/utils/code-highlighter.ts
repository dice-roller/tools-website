import { createHighlighterCoreSync } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import light from "@shikijs/themes/github-light-high-contrast";
import dark from "@shikijs/themes/github-dark-high-contrast";

export const codeThemes = {
  light: "github-light-high-contrast",
  dark: "github-dark-high-contrast",
} as const;

export type CodeLanguage = "json" | "javascript" | "text";

// Reuse a single highlighter, with only the languages and themes we need.
const highlighter = createHighlighterCoreSync({
  themes: [light, dark],
  langs: [json, javascript],
  engine: createJavaScriptRegexEngine(),
});

// Avoid creating a DOM element for every token in very large roll exports.
const maxHighlightedLength = 100_000;

export function highlightCode(
  code: string,
  language: CodeLanguage,
  theme: (typeof codeThemes)[keyof typeof codeThemes],
) {
  if (language === "text" || code.length > maxHighlightedLength) {
    return undefined;
  }

  return highlighter.codeToTokens(code, { lang: language, theme });
}
