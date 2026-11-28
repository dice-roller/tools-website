<script setup lang="ts">
import {
  codeThemes,
  highlightCode,
  type CodeLanguage,
} from "~/utils/code-highlighter";

const props = withDefaults(
  defineProps<{
    code: string;
    language: CodeLanguage;
    filename?: string;
    icon?: string;
    copyLabel?: string;
    announce?: boolean;
  }>(),
  {
    filename: undefined,
    icon: undefined,
    copyLabel: "Copy code",
    announce: false,
  },
);

const colorMode = useColorMode();
const copyOptions = computed(() => ({
  type: "button" as const,
  "aria-label": props.copyLabel,
}));
const highlighted = computed(() =>
  highlightCode(
    props.code,
    props.language,
    colorMode.value === "dark" ? codeThemes.dark : codeThemes.light,
  ),
);

// Render token text as Vue nodes, not injected HTML. Preserve the exact
// whitespace so the displayed source remains valid, selectable code.
const HighlightedCode = () =>
  h(
    "code",
    props.announce ? { role: "status" } : {},
    highlighted.value
      ? highlighted.value.tokens.flatMap((line, index) => [
          ...line.map((token) =>
            h(
              "span",
              {
                style: {
                  color:
                    token.color === highlighted.value?.fg
                      ? "inherit"
                      : token.color,
                },
              },
              token.content,
            ),
          ),
          ...(index < highlighted.value!.tokens.length - 1 ? ["\n"] : []),
        ])
      : props.code,
  );
</script>

<template>
  <ProsePre
    :code="code"
    :language="language"
    :filename="filename"
    :icon="icon"
    :copy="copyOptions"
    :ui="{
      root: 'my-4 min-w-0',
      base: 'max-h-[32rem] overflow-auto whitespace-pre bg-muted text-default',
      copy: 'lg:opacity-100',
    }"
    tabindex="0"
  >
    <HighlightedCode />
  </ProsePre>
</template>
