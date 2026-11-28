<script setup lang="ts">
import type { AccordionItem, DropdownMenuItem, TabsItem } from "@nuxt/ui";
import { convert } from "@dice-roller/convertor";
import {
  Roller,
  presenters,
  RollSettings,
  type Roll,
  type RollInputData,
  type RollLimits,
} from "@dice-roller/rpg-dice-roller";
import { SvgPresenter } from "@dice-roller/svg-presenter";
import { presenterDefinitions } from "~/data/presenter-options";
import { buildPlaygroundCode } from "~/utils/playground-code";
import {
  breakpointsTailwind,
  createReusableTemplate,
  useBreakpoints,
} from "@vueuse/core";

// Prerendered controls must not accept input before their Vue handlers exist.
const formReady = ref(false);
onMounted(() => {
  formReady.value = true;
});

const { documentationBaseUrl } = useRuntimeConfig().public;
const notationGuideUrl = new URL(
  "guide/notation/",
  `${documentationBaseUrl.replace(/\/+$/, "")}/`,
).href;

useSeoMeta({
  title: "Dice playground",
  description: "Experiment with dice notation and explore the results.",
});

let roller = new Roller();
const defaultLimits = roller.limits;
const engineRegistry = roller.settings.engines;
const defaultEngine = "nativeMath";
const engineLabels: Record<string, string> = {
  nativeMath: "Native Math (default)",
  mersenne: "Mersenne Twister",
  xoroshiro128plus: "Xoroshiro128plus",
  crypto: "Crypto",
};
const engineItems = engineRegistry.names.map((name) => ({
  label: engineLabels[name] ?? name,
  value: name,
}));
let activeEngine = defaultEngine;
let activeSeed: number | undefined;
let resetEngine = false;
const svgDefaults = new SvgPresenter().appearance;
const textDefaults = presenters.defaultTextPresenter;

function defaultTextOptions() {
  return {
    flagSymbols: { ...textDefaults.flagSymbols },
    separator: textDefaults.separator,
    expandInlineRolls: textDefaults.expandInlineRolls,
  };
}

const latestRoll = shallowRef<Roll>();
const notationError = ref("");
const variablesError = ref("");
const seedError = ref("");
const limitKeys = ["maxQty", "maxIterations", "maxGeneratedRolls"] as const;
const limitErrors = reactive<Record<keyof RollLimits, string>>({
  maxQty: "",
  maxIterations: "",
  maxGeneratedRolls: "",
});
const hasLimitErrors = computed(() =>
  limitKeys.some((key) => Boolean(limitErrors[key])),
);
const notationFieldError = computed(
  () =>
    notationError.value ||
    (variablesError.value
      ? "Invalid variable data. Check the Variables section."
      : hasLimitErrors.value
        ? "Invalid roll limits. Check the Roll limits section."
        : seedError.value
          ? "Invalid seed. Check the Seed field."
          : undefined),
);
const configurationOpen = ref(true);
const configurationView = ref<"main" | "presenter">("main");
let focusConfigurationView = false;

function navigateConfiguration(view: typeof configurationView.value) {
  focusConfigurationView = true;
  configurationView.value = view;
}

function onConfigurationViewEntered(element: Element) {
  if (!focusConfigurationView) return;
  focusConfigurationView = false;
  element
    .querySelector<HTMLElement>("[data-configuration-navigation]")
    ?.focus();
}

function onConfigurationViewLeaving(element: Element) {
  element.setAttribute("inert", "");
}
const desktop = useBreakpoints(breakpointsTailwind).greaterOrEqual("md");
const [DefineConfiguration, ReuseConfiguration] = createReusableTemplate();
const configurationTrigger = useTemplateRef("configurationTrigger");

function revealConfiguration() {
  focusConfigurationView = false;
  configurationView.value = "main";
  configurationOpen.value = true;
}

function restoreConfigurationFocus(event: Event) {
  if (desktop.value) return;
  event.preventDefault();
  configurationTrigger.value?.$el?.focus();
}

watch(configurationOpen, (open) => {
  if (!open && !desktop.value) {
    focusConfigurationView = false;
    configurationView.value = "main";
  }
});

const advancedOpen = ref<string[]>([]);

const dataFormat = ref<"full" | "concise">("full");
const dataFormats = [
  { label: "Full", value: "full" },
  { label: "Concise", value: "concise" },
] as const;
const dataResult = computed(() => {
  if (!latestRoll.value) {
    return { code: "", error: "" };
  }

  try {
    const full = latestRoll.value.export();
    const data =
      dataFormat.value === "concise"
        ? convert(full, 1, { format: "concise" })
        : full;

    return {
      code: JSON.stringify(data, null, 2),
      error: "",
    };
  } catch (cause) {
    return {
      code: "",
      error:
        cause instanceof Error
          ? cause.message
          : "An unexpected error occurred.",
    };
  }
});

function defaultConfiguration() {
  return {
    presenter: "Text" as keyof typeof presenterDefinitions,
    textOptions: defaultTextOptions(),
    svgOptions: { ...svgDefaults },
    engine: defaultEngine,
    seed: "",
    variables: "{}",
    maxQty: String(defaultLimits.maxQty),
    maxIterations: String(defaultLimits.maxIterations),
    maxGeneratedRolls: String(defaultLimits.maxGeneratedRolls),
  };
}

const state = reactive({
  notation: "4d6kh3 + 2",
  ...defaultConfiguration(),
});

function resetConfiguration() {
  Object.assign(state, defaultConfiguration());
  // Apply the reset engine and limits on the next roll, preserving history.
  resetEngine = true;
  notationError.value = "";
  variablesError.value = "";
  seedError.value = "";
  for (const key of limitKeys) limitErrors[key] = "";
  revealConfiguration();
}

const textPresenter = computed(
  () => new presenters.TextPresenter(state.textOptions),
);
const svgPresenter = computed(() => new SvgPresenter(state.svgOptions));
const textResult = computed(
  () => latestRoll.value?.present(textPresenter.value) ?? "",
);

const selectedPresenter = computed(() => presenterDefinitions[state.presenter]);
const presenterGuideUrl = computed(
  () =>
    new URL(
      selectedPresenter.value.documentationPath,
      `${documentationBaseUrl.replace(/\/+$/, "")}/`,
    ).href,
);

function updatePresenterOptions(values: Record<string, unknown>) {
  Object.assign(state[selectedPresenter.value.stateKey], values);
}

function resetPresenterOptions() {
  if (state.presenter === "SVG") {
    state.svgOptions = { ...svgDefaults };
  } else {
    state.textOptions = defaultTextOptions();
  }
}

// The registry has no seed capability metadata. Built-in factories reject
// an explicit seed when unsupported; a successful probe never draws dice.
const seedSupported = computed(() => {
  try {
    engineRegistry.create(state.engine, 0);
    return true;
  } catch {
    return false;
  }
});

watch(
  () => state.engine,
  () => {
    resetEngine = true;
    seedError.value = "";
    ensureSeed();
  },
  { flush: "sync" },
);
watch(
  () => state.seed,
  () => {
    seedError.value = "";
  },
  { flush: "sync" },
);

function generateSeed() {
  state.seed = String((Math.random() * 0x1_0000_0000) | 0);
  resetEngine = true;
}

function ensureSeed() {
  if (seedSupported.value && state.seed.trim() === "") {
    generateSeed();
  }
}

function resetRandomSequence() {
  resetEngine = true;
}

const visualResult = computed(() => {
  if (!latestRoll.value) {
    return { output: "", error: "" };
  }

  try {
    return {
      output:
        state.presenter === "SVG"
          ? latestRoll.value.present(svgPresenter.value)
          : textResult.value,
      error: "",
    };
  } catch (cause) {
    return {
      output: "",
      error:
        cause instanceof Error
          ? cause.message
          : "An unexpected error occurred.",
    };
  }
});

watch(
  () => state.notation,
  () => {
    notationError.value = "";
  },
  { flush: "sync" },
);

watch(
  () => state.variables,
  () => {
    variablesError.value = "";
  },
  { flush: "sync" },
);

for (const key of limitKeys) {
  watch(
    () => state[key],
    () => {
      limitErrors[key] = "";
    },
    { flush: "sync" },
  );
}

function readVariableData(): RollInputData {
  const parsed: unknown = state.variables.trim()
    ? JSON.parse(state.variables)
    : {};

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Variables must be a JSON object.");
  }

  // Use the library's own validation for nested variable values.
  return RollSettings.withData(roller.settings, parsed as RollInputData).data;
}

const codeResult = computed(() => {
  try {
    const seed =
      seedSupported.value && state.seed.trim() ? Number(state.seed) : undefined;
    if (
      seed !== undefined &&
      (!Number.isInteger(seed) || seed < -2147483648 || seed > 2147483647)
    ) {
      throw new Error("Enter a valid signed 32-bit integer in the Seed field.");
    }
    const limits = {
      maxQty: Number(state.maxQty),
      maxIterations: Number(state.maxIterations),
      maxGeneratedRolls: Number(state.maxGeneratedRolls),
    };
    if (
      limitKeys.some(
        (key) => !Number.isSafeInteger(limits[key]) || limits[key] < 1,
      )
    ) {
      throw new Error(
        "Enter positive whole numbers in the Roll limits section.",
      );
    }
    return {
      ...buildPlaygroundCode({
        notation: state.notation,
        engine: state.engine,
        defaultEngine,
        seed,
        limits,
        defaultLimits,
        data: readVariableData(),
        presenter: state.presenter,
        presenterOptions: state[selectedPresenter.value.stateKey],
        presenterDefaults:
          state.presenter === "SVG" ? { ...svgDefaults } : defaultTextOptions(),
      }),
      error: "",
    };
  } catch (cause) {
    return {
      code: "",
      install: "",
      error:
        cause instanceof SyntaxError
          ? "Enter valid JSON in the Variables section."
          : cause instanceof Error
            ? cause.message
            : "An unexpected error occurred.",
    };
  }
});

function onSubmit() {
  notationError.value = "";
  variablesError.value = "";
  seedError.value = "";

  ensureSeed();
  const seed = seedSupported.value ? Number(state.seed) : undefined;
  if (
    seed !== undefined &&
    (!Number.isInteger(seed) || seed < -2147483648 || seed > 2147483647)
  ) {
    seedError.value =
      "Enter a signed 32-bit integer (-2147483648 to 2147483647).";
    revealConfiguration();
    return;
  }

  const limits: RollLimits = {
    maxQty: Number(state.maxQty),
    maxIterations: Number(state.maxIterations),
    maxGeneratedRolls: Number(state.maxGeneratedRolls),
  };

  for (const key of limitKeys) {
    limitErrors[key] =
      Number.isSafeInteger(limits[key]) && limits[key] > 0
        ? ""
        : "Enter a positive whole number no greater than 9,007,199,254,740,991.";
  }

  if (hasLimitErrors.value) {
    revealConfiguration();
    if (!advancedOpen.value.includes("limits")) {
      advancedOpen.value = [...advancedOpen.value, "limits"];
    }
    return;
  }

  let data: RollInputData;

  try {
    data = readVariableData();
  } catch (cause) {
    variablesError.value =
      cause instanceof SyntaxError
        ? "Enter valid JSON."
        : cause instanceof Error
          ? cause.message
          : "Invalid variable data.";
    revealConfiguration();
    if (!advancedOpen.value.includes("variables")) {
      advancedOpen.value = [...advancedOpen.value, "variables"];
    }
    return;
  }

  try {
    // Keep the engine instance unless its selection or seed changes.
    // Reconfiguring limits alone must not restart the random sequence.
    const engineChanged =
      resetEngine || state.engine !== activeEngine || seed !== activeSeed;
    if (
      engineChanged ||
      limitKeys.some((key) => roller.limits[key] !== limits[key])
    ) {
      const nextRoller = new Roller({
        limits,
        engines: engineRegistry,
        engine: engineChanged
          ? { name: state.engine, seed }
          : roller.generator.engine,
      });
      for (const roll of roller.history) {
        nextRoller.history.add(roll);
      }
      roller = nextRoller;
      activeEngine = state.engine;
      activeSeed = seed;
      resetEngine = false;
    }

    // Roller records each successful roll in its own history.
    latestRoll.value = roller.roll(state.notation, { data });
  } catch (cause) {
    notationError.value =
      cause instanceof Error ? cause.message : "An unexpected error occurred.";
  }
}

function rollNotation(notation: string, data?: RollInputData) {
  if (data !== undefined) {
    state.variables = JSON.stringify(data, null, 2);
  }

  state.notation = notation;
  onSubmit();
}

const dice = [
  { label: "D4", icon: "i-lucide-triangle", notation: "d4" },
  { label: "D6", icon: "i-lucide-square", notation: "d6" },
  { label: "D8", icon: "i-lucide-diamond", notation: "d8" },
  { label: "D10", icon: null, notation: "d10" },
  { label: "D12", icon: "i-lucide-pentagon", notation: "d12" },
  { label: "D20", icon: "i-lucide-hexagon", notation: "d20" },
  { label: "D%", icon: "i-lucide-percent", notation: "d%" },
  { label: "DF", icon: "i-lucide-square-plus", notation: "dF" },
];

interface PlaygroundExample {
  label: string;
  notation: string;
  data?: RollInputData;
}

const exampleGroups: { label: string; examples: PlaygroundExample[] }[] = [
  {
    label: "Common rolls",
    examples: [
      { label: "Basic roll", notation: "2d6+3" },
      { label: "Advantage", notation: "2d20kh1" },
      { label: "Disadvantage", notation: "2d20kl1" },
      { label: "Ability scores", notation: "4d6kh3" },
    ],
  },
  {
    label: "Dice types",
    examples: [
      { label: "Fudge dice", notation: "4dF" },
      { label: "Custom faces", notation: "3d{1,2,5,8}" },
      { label: "Range dice", notation: "4d{-2...2}" },
    ],
  },
  {
    label: "Modifiers",
    examples: [
      { label: "Exploding dice", notation: "2d6!2" },
      { label: "Re-roll once", notation: "2d8ro=8" },
      { label: "Unique dice", notation: "5d6u" },
      { label: "Success counting", notation: "6d10>=8" },
      { label: "Weighted targets", notation: "6d10>=8=10:2" },
    ],
  },
  {
    label: "Expressions",
    examples: [
      { label: "Roll groups", notation: "{4d10, 5d6, 2d10}k2" },
      { label: "Calculated sides", notation: "3d(2*6)" },
      { label: "Maths functions", notation: "floor(4d6/3)" },
      {
        label: "Conditional roll",
        notation: "((2d6 + 4) > 10) ? (2d8) : (0)",
      },
    ],
  },
  {
    label: "Variables",
    examples: [
      {
        label: "Attack bonus",
        notation: "d20+$bonus",
        data: { bonus: 3 },
      },
      {
        label: "Character attack",
        notation: "d20+$character.attackBonus",
        data: { character: { attackBonus: 2 } },
      },
      {
        label: "Calculated quantity",
        notation: "(max($bonus+$character.attackBonus, 4))d10",
        data: { bonus: 3, character: { attackBonus: 2 } },
      },
    ],
  },
];

const examples: DropdownMenuItem[][] = exampleGroups.map((group) => [
  { type: "label", label: group.label },
  ...group.examples.map(({ label, notation, data }) => ({
    label,
    description: notation,
    data,
    onSelect: () => rollNotation(notation, data),
  })),
]);

const tabs: TabsItem[] = [
  { label: "Visual", icon: "i-lucide-eye", value: "visual" },
  { label: "Text", icon: "i-lucide-file-text", value: "text" },
  { label: "Data", icon: "i-lucide-braces", value: "data" },
  { label: "Code", icon: "i-lucide-code", value: "code" },
];

const advancedOptions: AccordionItem[] = [
  {
    label: "Variables",
    icon: "i-lucide-braces",
    slot: "variables",
    value: "variables",
  },
  {
    label: "Roll limits",
    icon: "i-lucide-shield",
    slot: "limits",
    value: "limits",
  },
];

const statistics = [
  "Total",
  "Kept dice",
  "Dropped dice",
  "Minimum",
  "Maximum",
  "Average",
];
</script>

<template>
  <div class="relative isolate">
    <div class="playground-artwork" aria-hidden="true" />
    <UContainer class="pb-12">
      <UPageHeader
        title="Dice playground"
        description="Experiment with dice notation, configure the dice roller and explore the results."
        class="border-0 pt-6 pb-6"
        :ui="{
          title: 'font-serif text-4xl sm:text-5xl',
          description: 'mt-2 max-w-3xl text-toned',
        }"
      />

      <UForm
        :state="state"
        aria-label="Playground configuration"
        @submit="onSubmit"
      >
        <fieldset :disabled="!formReady" class="min-w-0 space-y-5">
          <UCard :ui="{ body: 'p-4 sm:p-5' }">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-end">
              <UFormField
                name="notation"
                label="Notation"
                :error="notationFieldError"
                class="min-w-0 flex-1"
                :ui="{
                  labelWrapper: 'justify-start gap-1',
                  hint: 'flex flex-1 items-center gap-2',
                }"
              >
                <template #hint>
                  <FieldInfo
                    label="Notation"
                    text="Enter an expression using RPG Dice Roller notation."
                  />
                  <UButton
                    :to="notationGuideUrl"
                    target="_blank"
                    label="Notation guide"
                    trailing-icon="i-lucide-external-link"
                    variant="link"
                    size="xs"
                    class="ms-auto min-h-6 shrink-0 px-0 hover:underline"
                    aria-label="Notation guide (opens in a new tab)"
                  />
                </template>
                <template #error="{ error }">
                  <span v-if="error" role="alert" class="wrap-anywhere">{{
                    error
                  }}</span>
                </template>
                <UInput
                  v-model="state.notation"
                  size="xl"
                  class="w-full font-mono"
                  autocomplete="off"
                />
              </UFormField>
              <UButton
                type="submit"
                label="Roll dice"
                icon="i-lucide-dices"
                size="xl"
                class="justify-center"
              />
              <div
                class="flex flex-wrap items-center gap-2 border-default xl:border-s xl:ps-4"
              >
                <UButton
                  v-for="die in dice"
                  :key="die.label"
                  :label="die.label"
                  :icon="die.icon ?? undefined"
                  type="button"
                  color="neutral"
                  variant="outline"
                  @click="rollNotation(die.notation)"
                >
                  <template v-if="die.label === 'D10'" #leading>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="size-5 shrink-0"
                      aria-hidden="true"
                    >
                      <path d="M12 2 21 9 12 22 3 9Z" />
                    </svg>
                  </template>
                </UButton>
                <UDropdownMenu
                  :items="examples"
                  :modal="false"
                  :content="{ align: 'end' }"
                  :ui="{
                    content: 'w-72 max-w-[calc(100vw-1rem)]',
                    itemDescription:
                      'font-mono whitespace-normal wrap-anywhere',
                  }"
                >
                  <UButton
                    label="Examples"
                    icon="i-lucide-book-open"
                    trailing-icon="i-lucide-chevron-down"
                    type="button"
                    color="neutral"
                    variant="outline"
                  />
                  <template #item-trailing="{ item }">
                    <ExampleDataInfo v-if="item.data" />
                  </template>
                </UDropdownMenu>
              </div>
            </div>
          </UCard>

          <UButton
            ref="configurationTrigger"
            :label="
              desktop
                ? configurationOpen
                  ? 'Collapse configuration'
                  : 'Expand configuration'
                : 'Configuration'
            "
            :icon="
              desktop
                ? configurationOpen
                  ? 'i-lucide-panel-left-close'
                  : 'i-lucide-panel-left-open'
                : 'i-lucide-settings-2'
            "
            :aria-haspopup="desktop ? undefined : 'dialog'"
            :aria-expanded="configurationOpen"
            type="button"
            color="neutral"
            variant="outline"
            @click="configurationOpen = !configurationOpen"
          />

          <DefineConfiguration>
            <div
              id="playground-configuration-content"
              class="relative min-w-0 overflow-x-clip"
            >
              <Transition
                :name="
                  configurationView === 'presenter'
                    ? 'configuration-back'
                    : 'configuration-forward'
                "
                mode="out-in"
                @before-leave="onConfigurationViewLeaving"
                @after-enter="onConfigurationViewEntered"
              >
                <div
                  v-if="configurationView === 'main'"
                  key="main"
                  class="space-y-5 border-t border-default p-4"
                >
                  <UFormField
                    name="presenter"
                    label="Presenter"
                    :ui="{
                      labelWrapper: 'justify-start gap-1',
                      hint: 'flex flex-1 items-center justify-between gap-1',
                    }"
                  >
                    <template #hint>
                      <FieldInfo
                        label="Presenter"
                        text="Choose how the roll is displayed in the Visual tab. Changing the presenter does not roll the dice again."
                      />
                      <FieldInfo
                        label="immediate presenter changes"
                        icon="i-lucide-zap"
                        text="Changes are applied immediately to existing roll results, without rerolling."
                      />
                    </template>
                    <USelectMenu
                      v-model="state.presenter"
                      :items="
                        Object.keys(
                          presenterDefinitions,
                        ) as (keyof typeof presenterDefinitions)[]
                      "
                      :search-input="false"
                      icon="i-lucide-palette"
                      size="lg"
                      class="w-full"
                    />
                  </UFormField>

                  <UButton
                    label="Presenter options"
                    trailing-icon="i-lucide-chevron-right"
                    type="button"
                    color="neutral"
                    variant="outline"
                    class="w-full justify-between"
                    data-configuration-navigation
                    @click="navigateConfiguration('presenter')"
                  />

                  <UButton
                    :to="presenterGuideUrl"
                    target="_blank"
                    label="Presenter documentation"
                    icon="i-lucide-book-open"
                    trailing-icon="i-lucide-external-link"
                    variant="link"
                    size="sm"
                    class="min-h-6 px-0 hover:underline"
                    aria-label="Presenter documentation (opens in a new tab)"
                  />

                  <div>
                    <UFormField
                      name="engine"
                      label="Random engine"
                      :ui="{ labelWrapper: 'justify-start gap-1' }"
                    >
                      <template #hint>
                        <FieldInfo
                          label="Random engine"
                          text="Choose how random numbers are generated for dice and additional rolls triggered by modifiers."
                        />
                      </template>
                      <USelectMenu
                        v-model="state.engine"
                        :items="engineItems"
                        value-key="value"
                        :search-input="false"
                        icon="i-lucide-shuffle"
                        size="lg"
                        class="w-full"
                      />
                    </UFormField>

                    <UCollapsible
                      id="playground-seed-controls"
                      :open="seedSupported"
                      :inert="!seedSupported"
                      :ui="{ content: 'motion-reduce:animate-none!' }"
                    >
                      <template #content>
                        <div class="pt-5">
                          <UFormField
                            name="seed"
                            label="Seed"
                            :error="seedError || undefined"
                            :ui="{ labelWrapper: 'justify-start gap-1' }"
                          >
                            <template #hint>
                              <FieldInfo
                                label="Seed"
                                text="Set a signed 32-bit integer for a repeatable sequence with a seedable engine. An empty seed is generated automatically when selecting a seedable engine or rolling. Reset restarts the sequence on the next roll."
                              />
                            </template>
                            <template #error="{ error }">
                              <span
                                v-if="error"
                                role="alert"
                                class="wrap-anywhere"
                                >{{ error }}</span
                              >
                            </template>
                            <div class="flex gap-2">
                              <UInput
                                v-model="state.seed"
                                size="lg"
                                class="min-w-0 flex-1"
                                :disabled="!seedSupported"
                              />
                              <UButton
                                icon="i-lucide-wand-sparkles"
                                aria-label="Generate seed"
                                type="button"
                                color="neutral"
                                variant="outline"
                                :disabled="!seedSupported"
                                @click="generateSeed"
                              />
                              <UButton
                                icon="i-lucide-rotate-ccw"
                                aria-label="Reset random sequence"
                                type="button"
                                color="neutral"
                                variant="outline"
                                :disabled="!seedSupported"
                                @click="resetRandomSequence"
                              />
                            </div>
                          </UFormField>
                        </div>
                      </template>
                    </UCollapsible>
                  </div>

                  <UAccordion
                    v-model="advancedOpen"
                    type="multiple"
                    :items="advancedOptions"
                    class="rounded-md border border-default px-3"
                    :ui="{ body: 'pb-3' }"
                  >
                    <template #variables-body>
                      <UFormField
                        name="variables"
                        label="Variables (JSON data)"
                        :error="variablesError || undefined"
                        :ui="{ labelWrapper: 'justify-start gap-1' }"
                      >
                        <template #hint>
                          <FieldInfo
                            label="Variables (JSON data)"
                            text="Supply a JSON object of numbers or booleans to use in notation, such as $bonus or $character.attackBonus."
                          />
                        </template>
                        <template #error="{ error }">
                          <span
                            v-if="error"
                            role="alert"
                            class="wrap-anywhere"
                            >{{ error }}</span
                          >
                        </template>
                        <UTextarea
                          v-model="state.variables"
                          class="w-full font-mono"
                          :rows="4"
                        />
                      </UFormField>
                    </template>
                    <template #limits-body>
                      <div class="space-y-3">
                        <UFormField
                          name="maxQty"
                          label="Maximum dice quantity"
                          :error="limitErrors.maxQty || undefined"
                          :ui="{ labelWrapper: 'justify-start gap-1' }"
                        >
                          <template #hint>
                            <FieldInfo
                              label="Maximum dice quantity"
                              text="Limit the number of dice initially rolled in each pool, before modifiers are applied."
                            />
                          </template>
                          <template #error="{ error }">
                            <span
                              v-if="error"
                              role="alert"
                              class="wrap-anywhere"
                              >{{ error }}</span
                            >
                          </template>
                          <UInput
                            v-model="state.maxQty"
                            class="w-full"
                            inputmode="numeric"
                          />
                        </UFormField>
                        <UFormField
                          name="maxIterations"
                          label="Maximum iterations"
                          :error="limitErrors.maxIterations || undefined"
                          :ui="{ labelWrapper: 'justify-start gap-1' }"
                        >
                          <template #hint>
                            <FieldInfo
                              label="Maximum iterations"
                              text="Limit explosion and re-roll generations, or uniqueness retries, per die."
                            />
                          </template>
                          <template #error="{ error }">
                            <span
                              v-if="error"
                              role="alert"
                              class="wrap-anywhere"
                              >{{ error }}</span
                            >
                          </template>
                          <UInput
                            v-model="state.maxIterations"
                            class="w-full"
                            inputmode="numeric"
                          />
                        </UFormField>
                        <UFormField
                          name="maxGeneratedRolls"
                          label="Maximum generated rolls"
                          :error="limitErrors.maxGeneratedRolls || undefined"
                          :ui="{ labelWrapper: 'justify-start gap-1' }"
                        >
                          <template #hint>
                            <FieldInfo
                              label="Maximum generated rolls"
                              text="Limit additional rolls across modifiers in each pool, including discarded rolls. Initial dice do not count towards this limit."
                            />
                          </template>
                          <template #error="{ error }">
                            <span
                              v-if="error"
                              role="alert"
                              class="wrap-anywhere"
                              >{{ error }}</span
                            >
                          </template>
                          <UInput
                            v-model="state.maxGeneratedRolls"
                            class="w-full"
                            inputmode="numeric"
                          />
                        </UFormField>
                      </div>
                    </template>
                  </UAccordion>
                </div>
                <div
                  v-else
                  key="presenter"
                  class="space-y-5 border-t border-default p-4"
                >
                  <UButton
                    label="Back to configuration"
                    icon="i-lucide-chevron-left"
                    type="button"
                    color="neutral"
                    variant="ghost"
                    data-configuration-navigation
                    class="-ms-2"
                    @click="navigateConfiguration('main')"
                  />
                  <h3 class="font-serif text-lg font-semibold text-highlighted">
                    {{ state.presenter }} presenter options
                  </h3>

                  <UButton
                    :to="presenterGuideUrl"
                    target="_blank"
                    label="Presenter documentation"
                    icon="i-lucide-book-open"
                    trailing-icon="i-lucide-external-link"
                    variant="link"
                    size="sm"
                    class="min-h-6 px-0 hover:underline"
                    aria-label="Presenter documentation (opens in a new tab)"
                  />

                  <PresenterOptionFields
                    :key="state.presenter"
                    :fields="selectedPresenter.fields"
                    :values="state[selectedPresenter.stateKey]"
                    :prefix="selectedPresenter.stateKey"
                    @update="updatePresenterOptions"
                  />
                  <UButton
                    label="Reset presenter options"
                    icon="i-lucide-rotate-ccw"
                    type="button"
                    color="neutral"
                    variant="outline"
                    class="w-full justify-center"
                    @click="resetPresenterOptions"
                  />
                </div>
              </Transition>
            </div>
          </DefineConfiguration>

          <div
            class="flex items-start"
            :class="{ 'md:gap-5': configurationOpen }"
          >
            <USidebar
              v-model:open="configurationOpen"
              as="section"
              aria-label="Configuration"
              breakpoint="md"
              collapsible="offcanvas"
              mode="modal"
              rail
              transition
              :menu="{
                title: 'Configuration',
                description: 'Configure the dice roller.',
                fullscreen: true,
                content: { onCloseAutoFocus: restoreConfigurationFocus },
              }"
              :ui="{
                root: 'shrink-0 [--sidebar-width:19rem]',
                gap: 'hidden',
                container:
                  'relative inset-auto h-auto min-h-12 border-0 data-[state=collapsed]:start-auto data-[state=collapsed]:w-0',
                inner:
                  'h-auto min-w-0 rounded-lg bg-default ring ring-default transition-[visibility] duration-200 motion-reduce:transition-none group-data-[state=collapsed]/sidebar:invisible group-data-[state=collapsed]/sidebar:ring-0',
                header: 'w-(--sidebar-width) min-h-0 p-4',
                body: 'w-(--sidebar-width) overflow-visible p-0',
              }"
            >
              <template #header="{ open }">
                <div
                  :inert="!open"
                  class="flex w-full items-center justify-between gap-2"
                >
                  <h2 class="font-serif text-xl font-semibold text-highlighted">
                    Configuration
                  </h2>
                  <UButton
                    label="Reset"
                    icon="i-lucide-rotate-ccw"
                    type="button"
                    color="neutral"
                    variant="ghost"
                    aria-label="Reset configuration"
                    @click="resetConfiguration"
                  />
                </div>
              </template>

              <template #default="{ open }">
                <div v-if="desktop" :inert="!open">
                  <ReuseConfiguration />
                </div>
              </template>

              <template #content>
                <UForm
                  :state="state"
                  aria-label="Configuration settings"
                  class="flex min-h-0 flex-1 flex-col"
                  @submit="configurationOpen = false"
                >
                  <div
                    class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-default p-4"
                  >
                    <h2
                      class="font-serif text-xl font-semibold text-highlighted"
                    >
                      Configuration
                    </h2>
                    <div class="flex flex-wrap items-center justify-end gap-1">
                      <UButton
                        label="Reset"
                        icon="i-lucide-rotate-ccw"
                        type="button"
                        color="neutral"
                        variant="ghost"
                        aria-label="Reset configuration"
                        @click="resetConfiguration"
                      />
                      <UButton label="Done" type="submit" />
                    </div>
                  </div>
                  <div class="min-h-0 flex-1 overflow-y-auto">
                    <ReuseConfiguration v-if="!desktop" />
                  </div>
                </UForm>
              </template>
            </USidebar>

            <div class="min-w-0 flex-1 space-y-5">
              <UCard as="section" aria-label="Roll result">
                <template #header>
                  <div
                    class="flex flex-wrap items-center justify-between gap-2"
                  >
                    <h2
                      class="font-serif text-xl font-semibold text-highlighted"
                    >
                      Result
                    </h2>
                    <div class="flex flex-wrap gap-2">
                      <UButton
                        label="Copy"
                        icon="i-lucide-copy"
                        type="button"
                        color="neutral"
                        variant="outline"
                        disabled
                      />
                      <UButton
                        label="Export"
                        icon="i-lucide-download"
                        trailing-icon="i-lucide-chevron-down"
                        type="button"
                        color="neutral"
                        variant="outline"
                        disabled
                      />
                      <UButton
                        label="Share"
                        icon="i-lucide-share-2"
                        type="button"
                        color="neutral"
                        variant="outline"
                        disabled
                      />
                    </div>
                  </div>
                </template>

                <UTabs
                  :items="tabs"
                  default-value="visual"
                  variant="link"
                  :ui="{ list: 'flex-wrap', trigger: 'flex-none' }"
                >
                  <template #content="{ item }">
                    <template v-if="item.value === 'code'">
                      <UAlert
                        v-if="codeResult.error"
                        color="error"
                        variant="soft"
                        title="Unable to generate code"
                        :description="codeResult.error"
                        icon="i-lucide-circle-alert"
                        role="alert"
                        class="mt-4"
                      />
                      <template v-else>
                        <LazyCodeBlock
                          v-if="codeResult.install"
                          :code="codeResult.install"
                          language="text"
                          filename="Terminal"
                          copy-label="Copy install command"
                        />

                        <LazyCodeBlock
                          :code="codeResult.code"
                          language="javascript"
                          filename="roll.js"
                          copy-label="Copy JavaScript"
                        />
                      </template>
                    </template>
                    <UEmpty
                      v-else-if="!latestRoll"
                      icon="i-lucide-dices"
                      title="No rolls yet"
                      description="Enter some notation and roll the dice to see your results."
                      variant="naked"
                      class="min-h-44"
                    />
                    <template v-else-if="item.value === 'visual'">
                      <UAlert
                        v-if="visualResult.error"
                        color="error"
                        variant="soft"
                        title="Unable to present roll"
                        :description="visualResult.error"
                        icon="i-lucide-circle-alert"
                        role="alert"
                        class="mt-4"
                      />
                      <!-- The bundled SVG presenter escapes roll text and uses trusted artwork. -->
                      <!-- eslint-disable vue/no-v-html -->
                      <div
                        v-else-if="state.presenter === 'SVG'"
                        class="mt-4 min-w-0 overflow-x-auto [&>svg]:block [&>svg]:max-w-none"
                        role="region"
                        aria-label="Visual roll result"
                        tabindex="0"
                        v-html="visualResult.output"
                      />
                      <!-- eslint-enable vue/no-v-html -->
                      <p
                        v-else
                        class="min-h-44 py-8 font-mono whitespace-pre-wrap wrap-anywhere"
                        role="status"
                      >
                        {{ visualResult.output }}
                      </p>
                    </template>
                    <LazyCodeBlock
                      v-else-if="item.value === 'text'"
                      :code="textResult"
                      language="text"
                      hide-header
                      copy-label="Copy text"
                      announce
                    />
                    <template v-else-if="item.value === 'data'">
                      <div class="mt-4 flex justify-end">
                        <UFieldGroup
                          size="sm"
                          role="group"
                          aria-label="Data format"
                        >
                          <UButton
                            v-for="format in dataFormats"
                            :key="format.value"
                            :label="format.label"
                            :color="
                              dataFormat === format.value
                                ? 'primary'
                                : 'neutral'
                            "
                            :variant="
                              dataFormat === format.value ? 'solid' : 'outline'
                            "
                            :aria-pressed="dataFormat === format.value"
                            type="button"
                            @click="dataFormat = format.value"
                          />
                        </UFieldGroup>
                      </div>
                      <UAlert
                        v-if="dataResult.error"
                        color="error"
                        variant="soft"
                        title="Unable to export roll"
                        :description="dataResult.error"
                        icon="i-lucide-circle-alert"
                        role="alert"
                        class="mt-4"
                      />
                      <LazyCodeBlock
                        v-else
                        :code="dataResult.code"
                        language="json"
                        hide-header
                        copy-label="Copy JSON"
                      />
                    </template>
                  </template>
                </UTabs>

                <dl
                  class="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-default bg-default sm:grid-cols-3 xl:grid-cols-6"
                >
                  <div
                    v-for="statistic in statistics"
                    :key="statistic"
                    class="bg-elevated p-3 text-center"
                  >
                    <dt class="text-sm text-toned">{{ statistic }}</dt>
                    <dd
                      class="font-serif text-2xl font-semibold text-highlighted"
                    >
                      —
                    </dd>
                  </div>
                </dl>
              </UCard>

              <UCard as="section" aria-labelledby="playground-history-heading">
                <template #header>
                  <div
                    class="flex flex-wrap items-center justify-between gap-2"
                  >
                    <div class="flex flex-wrap items-center gap-2">
                      <UIcon name="i-lucide-history" class="size-5" />
                      <h2
                        id="playground-history-heading"
                        class="font-serif text-xl font-semibold text-highlighted"
                      >
                        Roll history
                      </h2>
                    </div>
                    <UButton
                      label="Clear history"
                      icon="i-lucide-trash-2"
                      type="button"
                      color="neutral"
                      variant="ghost"
                      disabled
                    />
                  </div>
                </template>

                <p class="text-sm text-muted">
                  Roll history display is not available yet.
                </p>
              </UCard>
            </div>
          </div>
        </fieldset>
      </UForm>
    </UContainer>
  </div>
</template>

<style scoped>
.playground-artwork {
  position: absolute;
  z-index: -1;
  inset: 0 0 auto auto;
  width: min(100%, 65rem);
  height: 15rem;
  background: url("~/assets/images/playground-background.png") center right /
    cover no-repeat;
  opacity: 0.75;
  pointer-events: none;
  mask-image:
    linear-gradient(to right, transparent, black 70%),
    linear-gradient(to bottom, black 20%, transparent);
  mask-composite: intersect;
}

:global(html:not(.dark) .playground-artwork) {
  opacity: 0.23;
}
/* Keep the transition inside the sidebar; the results never move. */
.configuration-forward-enter-active,
.configuration-forward-leave-active,
.configuration-back-enter-active,
.configuration-back-leave-active {
  transition: transform 150ms ease-in-out;
}

.configuration-forward-enter-from,
.configuration-back-leave-to {
  transform: translateX(-100%);
}

.configuration-forward-leave-to,
.configuration-back-enter-from {
  transform: translateX(100%);
}

@media (prefers-reduced-motion: reduce) {
  .configuration-forward-enter-active,
  .configuration-forward-leave-active,
  .configuration-back-enter-active,
  .configuration-back-leave-active {
    transition: none;
  }
}
</style>
