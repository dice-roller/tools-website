<script setup lang="ts">
import type { AccordionItem, DropdownMenuItem, TabsItem } from "@nuxt/ui";
import { convert } from "@dice-roller/convertor";
import {
  Roller,
  type Roll,
  type RollInputData,
} from "@dice-roller/rpg-dice-roller";

const { documentationBaseUrl } = useRuntimeConfig().public;
const notationGuideUrl = new URL(
  "guide/notation/",
  `${documentationBaseUrl.replace(/\/+$/, "")}/`,
).href;

useSeoMeta({
  title: "Dice playground",
  description: "Experiment with dice notation and explore the results.",
});

const roller = new Roller();
const latestRoll = shallowRef<Roll>();
const notationError = ref("");
const configurationOpen = ref(true);
const textResult = computed(() => latestRoll.value?.present() ?? "");
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

// Configuration controls are placeholders until they are connected to the roller.
const state = reactive({
  notation: "4d6kh3 + 2",
  presenter: "Text",
  engine: "Default",
  seed: "",
  variables: "{}",
  maxQty: String(roller.limits.maxQty),
  maxIterations: String(roller.limits.maxIterations),
  maxGeneratedRolls: String(roller.limits.maxGeneratedRolls),
});

watch(
  () => state.notation,
  () => {
    notationError.value = "";
  },
  { flush: "sync" },
);

function onSubmit() {
  notationError.value = "";

  try {
    // Roller records each successful roll in its own history.
    latestRoll.value = roller.roll(state.notation);
  } catch (cause) {
    notationError.value =
      cause instanceof Error ? cause.message : "An unexpected error occurred.";
  }
}

function rollNotation(notation: string) {
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
    // Variable data is stored for now, but not passed to the roller yet.
    onSelect: () => rollNotation(notation),
  })),
]);

const tabs: TabsItem[] = [
  { label: "Visual", icon: "i-lucide-eye", value: "visual" },
  { label: "Text", icon: "i-lucide-file-text", value: "text" },
  { label: "Data", icon: "i-lucide-braces", value: "data" },
  { label: "Code", icon: "i-lucide-code", value: "code" },
];

const presenterOptions: AccordionItem[] = [
  { label: "Presenter options", slot: "presenter" },
];
const advancedOptions: AccordionItem[] = [
  { label: "Variables", icon: "i-lucide-braces", slot: "variables" },
  { label: "Roll limits", icon: "i-lucide-shield", slot: "limits" },
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
    <UContainer class="max-w-[100rem] pb-12">
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
        class="space-y-5"
        @submit="onSubmit"
      >
        <UCard :ui="{ body: 'p-4 sm:p-5' }">
          <div class="flex flex-col gap-4 xl:flex-row xl:items-end">
            <UFormField
              name="notation"
              label="Notation"
              :error="notationError || undefined"
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
                  itemDescription: 'font-mono whitespace-normal wrap-anywhere',
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

        <div class="grid items-start gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <UCard
            as="section"
            aria-labelledby="playground-config-heading"
            :ui="{ root: 'divide-y-0', header: 'p-4', body: 'p-0' }"
          >
            <template #header>
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2
                  id="playground-config-heading"
                  class="font-serif text-xl font-semibold text-highlighted"
                >
                  Configuration
                </h2>
                <div class="flex items-center gap-1">
                  <UButton
                    label="Reset"
                    icon="i-lucide-rotate-ccw"
                    type="button"
                    color="neutral"
                    variant="ghost"
                    disabled
                  />
                  <UButton
                    :icon="
                      configurationOpen
                        ? 'i-lucide-chevron-up'
                        : 'i-lucide-chevron-down'
                    "
                    :aria-label="
                      configurationOpen
                        ? 'Collapse configuration'
                        : 'Expand configuration'
                    "
                    :aria-expanded="configurationOpen"
                    aria-controls="playground-configuration-content"
                    type="button"
                    color="neutral"
                    variant="ghost"
                    @click="configurationOpen = !configurationOpen"
                  />
                </div>
              </div>
            </template>

            <UCollapsible
              v-model:open="configurationOpen"
              :unmount-on-hide="false"
              :ui="{ content: 'motion-reduce:animate-none' }"
            >
              <template #content>
                <div
                  id="playground-configuration-content"
                  class="space-y-5 border-t border-default p-4"
                >
                  <UFormField name="presenter" label="Presenter">
                    <USelectMenu
                      v-model="state.presenter"
                      disabled
                      :items="['Cosmic (visual preview)', 'SVG', 'Text']"
                      :search-input="false"
                      icon="i-lucide-palette"
                      size="lg"
                      class="w-full"
                    />
                  </UFormField>

                  <UAccordion
                    :items="presenterOptions"
                    class="rounded-md border border-default px-3"
                  >
                    <template #presenter>
                      <p class="text-sm text-toned">
                        Dice size, modifier flags and label options will appear
                        here.
                      </p>
                    </template>
                  </UAccordion>

                  <UFormField name="engine" label="Random engine">
                    <USelectMenu
                      v-model="state.engine"
                      disabled
                      :items="[
                        'Default',
                        'Mersenne Twister',
                        'Xoroshiro128plus',
                        'Crypto',
                      ]"
                      :search-input="false"
                      icon="i-lucide-shuffle"
                      size="lg"
                      class="w-full"
                    />
                  </UFormField>

                  <UFormField name="seed" label="Seed">
                    <div class="flex gap-2">
                      <UInput
                        v-model="state.seed"
                        size="lg"
                        class="min-w-0 flex-1"
                        disabled
                      />
                      <UButton
                        icon="i-lucide-wand-sparkles"
                        aria-label="Generate seed"
                        type="button"
                        color="neutral"
                        variant="outline"
                        disabled
                      />
                      <UButton
                        icon="i-lucide-rotate-ccw"
                        aria-label="Reset random sequence"
                        type="button"
                        color="neutral"
                        variant="outline"
                        disabled
                      />
                    </div>
                  </UFormField>

                  <UAccordion
                    type="multiple"
                    :items="advancedOptions"
                    class="rounded-md border border-default px-3"
                  >
                    <template #variables>
                      <UFormField
                        name="variables"
                        label="Variables (JSON data)"
                      >
                        <UTextarea
                          v-model="state.variables"
                          disabled
                          class="w-full font-mono"
                          :rows="4"
                        />
                      </UFormField>
                    </template>
                    <template #limits>
                      <div class="space-y-3">
                        <UFormField name="maxQty" label="Maximum dice quantity">
                          <UInput
                            v-model="state.maxQty"
                            class="w-full"
                            disabled
                          />
                        </UFormField>
                        <UFormField
                          name="maxIterations"
                          label="Maximum iterations"
                        >
                          <UInput
                            v-model="state.maxIterations"
                            class="w-full"
                            disabled
                          />
                        </UFormField>
                        <UFormField
                          name="maxGeneratedRolls"
                          label="Maximum generated rolls"
                        >
                          <UInput
                            v-model="state.maxGeneratedRolls"
                            class="w-full"
                            disabled
                          />
                        </UFormField>
                      </div>
                    </template>
                  </UAccordion>
                </div>
              </template>
            </UCollapsible>
          </UCard>

          <div class="min-w-0 space-y-5">
            <UCard as="section" aria-label="Roll result">
              <template #header>
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h2 class="font-serif text-xl font-semibold text-highlighted">
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
                  <UEmpty
                    v-if="!latestRoll"
                    icon="i-lucide-dices"
                    title="No rolls yet"
                    description="Enter some notation and roll the dice to see your results."
                    variant="naked"
                    class="min-h-44"
                  />
                  <LazyCodeBlock
                    v-else-if="item.value === 'text'"
                    :code="textResult"
                    language="text"
                    hide-header
                    copy-label="Copy text"
                    role="status"
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
                          :color="dataFormat === format.value ? 'primary' : 'neutral'"
                          :variant="dataFormat === format.value ? 'solid' : 'outline'"
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
                  <p v-else class="min-h-44 py-8 text-muted">
                    {{ item.label }} output is not available yet.
                  </p>
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
                <div class="flex flex-wrap items-center justify-between gap-2">
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
  background: url("~/assets/images/playground-background.webp") center right /
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
</style>
