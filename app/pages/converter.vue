<script setup lang="ts">
import type { AccordionItem, BreadcrumbItem } from "@nuxt/ui";

definePageMeta({ toolArtwork: true });

useSeoMeta({
  title: "Data converter · Dice Roller Tools",
  description:
    "Convert RPG Dice Roller exports between supported data schemas and formats.",
});

const breadcrumbs: BreadcrumbItem[] = [
  { label: "Home", icon: "i-heroicons-home", to: "/" },
  { label: "Converter" },
];

const sourceVersions = [
  { label: "Auto-detect", value: "auto" },
  { label: "Legacy (v5)", value: "legacy" },
  { label: "Schema 1 (v6)", value: "1" },
];
const targetVersions = [
  { label: "Schema 1 (v6)", value: "1" },
  { label: "Latest supported", value: "latest" },
];
const formats = [
  { label: "Full", value: "full" },
  { label: "Concise", value: "concise" },
];
const encodings = [
  { label: "JSON", value: "json" },
  { label: "Base64", value: "base64" },
];

const sourceVersion = ref("auto");
const targetVersion = ref("1");
const format = ref("full");
const encoding = ref("json");
const strict = ref(true);
const input = ref("");

const help: AccordionItem[] = [
  { label: "Supported formats and conversion options", value: "formats" },
];
</script>

<template>
  <UContainer class="pb-12 sm:pb-16">
    <UPageHeader
      title="Data converter"
      description="Convert RPG Dice Roller exports between supported data schemas and formats. Your data stays in your browser."
      class="border-0 pt-6 pb-8 sm:pt-8"
      :ui="{
        title: 'font-serif text-4xl sm:text-5xl',
        headline: 'mb-4 font-normal',
        description: 'mt-3 max-w-3xl text-toned',
      }"
    >
      <template #headline>
        <UBreadcrumb :items="breadcrumbs" />
      </template>
    </UPageHeader>

    <div class="space-y-6">
      <UCard as="section" aria-labelledby="conversion-options-heading">
        <h2 id="conversion-options-heading" class="sr-only">
          Conversion options
        </h2>
        <div
          class="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
        >
          <UFormField name="target" label="Target version">
            <USelectMenu
              v-model="targetVersion"
              :items="targetVersions"
              value-key="value"
              :search-input="false"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField name="format" label="Output format">
            <USelectMenu
              v-model="format"
              :items="formats"
              value-key="value"
              :search-input="false"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <UFormField name="encoding" label="Encoding">
            <USelectMenu
              v-model="encoding"
              :items="encodings"
              value-key="value"
              :search-input="false"
              size="lg"
              class="w-full"
            />
          </UFormField>
          <USwitch
            v-model="strict"
            label="Strict conversion"
            size="xl"
            class="min-h-10 items-center"
            :ui="{ base: 'motion-reduce:transition-none' }"
          />
          <UButton
            label="Convert data"
            icon="i-heroicons-arrows-right-left"
            size="xl"
            disabled
            class="justify-center sm:col-span-2 lg:col-span-1"
          />
        </div>
      </UCard>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <UCard
          as="section"
          aria-labelledby="converter-input-heading"
          class="min-w-0"
        >
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2
                id="converter-input-heading"
                class="font-serif text-2xl font-semibold text-highlighted"
              >
                Input
              </h2>
              <div class="flex flex-wrap gap-2">
                <UButton
                  label="Upload file"
                  icon="i-heroicons-arrow-up-tray"
                  color="neutral"
                  variant="outline"
                  disabled
                />
                <UButton
                  label="Load example"
                  icon="i-lucide-flask-conical"
                  color="neutral"
                  variant="outline"
                  disabled
                />
              </div>
            </div>
          </template>

          <div class="space-y-4">
            <UFormField name="input" label="Data to convert">
              <UTextarea
                v-model="input"
                placeholder="Paste your JSON or Base64 export here…"
                :rows="9"
                class="w-full font-mono"
                :ui="{ base: 'min-h-48 resize-y' }"
                spellcheck="false"
                autocapitalize="off"
              />
            </UFormField>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField name="source" label="Source version">
                <USelectMenu
                  v-model="sourceVersion"
                  :items="sourceVersions"
                  value-key="value"
                  :search-input="false"
                  size="lg"
                  class="w-full"
                />
              </UFormField>
              <UFormField name="input-encoding" label="Input encoding">
                <UInput
                  model-value="Auto-detect"
                  readonly
                  size="lg"
                  class="w-full"
                />
              </UFormField>
            </div>
          </div>
        </UCard>

        <UCard
          as="section"
          aria-labelledby="converter-output-heading"
          class="flex min-w-0 flex-col"
          :ui="{ body: 'flex flex-1 flex-col' }"
        >
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2
                id="converter-output-heading"
                class="font-serif text-2xl font-semibold text-highlighted"
              >
                Output
              </h2>
              <div class="flex flex-wrap gap-2">
                <UButton
                  label="Copy"
                  icon="i-heroicons-clipboard"
                  color="neutral"
                  variant="outline"
                  disabled
                />
                <UButton
                  label="Download"
                  icon="i-lucide-download"
                  color="neutral"
                  variant="outline"
                  disabled
                />
              </div>
            </div>
          </template>

          <UEmpty
            icon="i-heroicons-document"
            description="Your converted data will appear here."
            variant="subtle"
            size="xl"
            class="min-h-64 flex-1"
          />
        </UCard>
      </div>

      <UAlert
        color="neutral"
        variant="subtle"
        icon="i-heroicons-shield-check"
        title="Conversion runs locally. No data is uploaded."
        description="The converter interface is a preview; conversion, file upload and output actions are not yet available."
      />

      <UCard :ui="{ body: 'py-0 sm:py-0' }">
        <UAccordion
          :items="help"
          :ui="{ trigger: 'py-4 text-base', body: 'space-y-3 text-toned' }"
        >
          <template #body>
            <p>
              Legacy (v5) exports and version 1 (v6) exports can be supplied as
              JSON or Base64. The input encoding is detected automatically.
            </p>
            <p>
              Convert to schema version 1, or select the latest supported
              schema. Reverse migrations to legacy are not supported.
            </p>
            <p>
              Full output preserves historical statistics and supports
              individual rolls and histories. Concise output is only available
              for individual rolls and does not retain historical statistics.
            </p>
            <p>
              Strict conversion rejects ambiguous or inconsistent data.
              Best-effort conversion can recover some inconsistencies and
              returns warnings.
            </p>
          </template>
        </UAccordion>
      </UCard>
    </div>
  </UContainer>
</template>
