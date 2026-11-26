<script setup lang="ts">
import {
  getSupportedFormats,
  getSupportedTargetVersions,
  getSupportedVersions,
  supportedEncodings,
} from "@dice-roller/convertor";
import type {
  DataVersion,
  ResultFormat,
  SupportedDataVersion,
  TargetVersion,
} from "@dice-roller/convertor";
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

function versionLabel(version: DataVersion): string {
  switch (version) {
    case "legacy":
      return "Legacy (v5)";
    case 1:
      return "Schema 1 (v6)";
    default:
      return `Schema ${version}`;
  }
}

const supportedVersions = getSupportedVersions();
const latestVersion = Math.max(
  ...supportedVersions.filter((version) => typeof version === "number"),
);
const sourceVersions = [
  { label: "Auto-detect", value: "auto" as const },
  ...supportedVersions.map((version) => ({
    label: versionLabel(version),
    value: version,
  })),
];

interface ConverterFormState {
  sourceVersion: SupportedDataVersion | "auto";
  targetVersion: TargetVersion;
  format: ResultFormat;
  encoding: "json" | "base64";
  inputEncoding: "auto" | "json" | "base64";
  strict: boolean;
  input: string;
}

const state = reactive<ConverterFormState>({
  sourceVersion: "auto",
  targetVersion: latestVersion,
  format: "full",
  encoding: "json",
  inputEncoding: "auto",
  strict: true,
  input: "",
});

const targetVersions = computed(() => {
  const versions = getSupportedTargetVersions(
    state.sourceVersion === "auto" ? undefined : state.sourceVersion,
  );
  const items: { label: string; value: TargetVersion }[] = versions.map(
    (version) => ({ label: versionLabel(version), value: version }),
  );

  if (versions.some((version) => version === latestVersion)) {
    items.push({ label: "Latest supported", value: "latest" });
  }

  return items;
});

const formats = computed(() =>
  getSupportedFormats(state.targetVersion).map((value) => ({
    label: value.charAt(0).toUpperCase() + value.slice(1),
    value,
  })),
);

const encodings = supportedEncodings
  .filter((value) => value !== "object")
  .map((value) => ({
    label: value === "base64" ? "Base64" : value.toUpperCase(),
    value,
  }));

const inputEncodings = [
  { label: "Auto-detect", value: "auto" as const },
  ...encodings,
];

watch(targetVersions, (items) => {
  if (!items.some((item) => item.value === state.targetVersion)) {
    state.targetVersion =
      items.find((item) => item.value === latestVersion)?.value ??
      items[0]?.value ??
      "latest";
  }
});

watch(formats, (items) => {
  if (!items.some((item) => item.value === state.format)) {
    state.format = "full";
  }
});

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
      <UForm
        :state="state"
        aria-labelledby="conversion-options-heading"
        class="space-y-6"
      >
        <UCard as="section" aria-labelledby="conversion-options-heading">
          <h2 id="conversion-options-heading" class="sr-only">
            Conversion options
          </h2>

          <div
            class="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
          >
            <UFormField
              name="targetVersion"
              label="Target version"
              :ui="{ labelWrapper: 'justify-start' }"
            >
              <template #hint>
                <FieldInfo
                  label="Target version"
                  text="Choose the destination data schema. Latest supported uses the newest schema the converter knows."
                />
              </template>

              <USelectMenu
                v-model="state.targetVersion"
                :items="targetVersions"
                value-key="value"
                :search-input="false"
                size="lg"
                class="w-full"
              />
            </UFormField>

            <UFormField
              name="format"
              label="Output format"
              :ui="{ labelWrapper: 'justify-start' }"
            >
              <template #hint>
                <FieldInfo
                  label="Output format"
                  text="Full preserves historical statistics. Concise is for individual rolls and omits historical statistics."
                />
              </template>

              <USelectMenu
                v-model="state.format"
                :items="formats"
                value-key="value"
                :search-input="false"
                size="lg"
                class="w-full"
              />
            </UFormField>

            <UFormField
              name="encoding"
              label="Encoding"
              :ui="{ labelWrapper: 'justify-start' }"
            >
              <template #hint>
                <FieldInfo
                  label="Output encoding"
                  text="Choose readable JSON or Base64 for the converted output."
                />
              </template>

              <USelectMenu
                v-model="state.encoding"
                :items="encodings"
                value-key="value"
                :search-input="false"
                size="lg"
                class="w-full"
              />
            </UFormField>

            <div class="flex min-h-10 items-center gap-1">
              <USwitch
                v-model="state.strict"
                name="strict"
                label="Strict conversion"
                size="xl"
                class="items-center"
                :ui="{ base: 'motion-reduce:transition-none' }"
              />
              <FieldInfo
                label="Strict conversion"
                text="Reject ambiguous or inconsistent data. Turn off to allow best-effort conversion with warnings."
              />
            </div>

            <UButton
              type="submit"
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
                    type="button"
                    label="Upload file"
                    icon="i-heroicons-arrow-up-tray"
                    color="neutral"
                    variant="outline"
                    disabled
                  />

                  <UButton
                    type="button"
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
              <UFormField
                name="input"
                label="Data to convert"
                :ui="{ labelWrapper: 'justify-start' }"
              >
                <template #hint>
                  <FieldInfo
                    label="Data to convert"
                    text="Paste an exported individual roll or roll history in JSON or Base64."
                  />
                </template>

                <UTextarea
                  v-model="state.input"
                  placeholder="Paste your JSON or Base64 export here…"
                  :rows="9"
                  class="w-full font-mono"
                  :ui="{ base: 'min-h-48 resize-y' }"
                  spellcheck="false"
                  autocapitalize="off"
                />
              </UFormField>

              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <UFormField
                  name="sourceVersion"
                  label="Source version"
                  :ui="{ labelWrapper: 'justify-start' }"
                >
                  <template #hint>
                    <FieldInfo
                      label="Source version"
                      text="Choose the original data schema, or use Auto-detect to identify it from the export."
                    />
                  </template>

                  <USelectMenu
                    v-model="state.sourceVersion"
                    :items="sourceVersions"
                    value-key="value"
                    :search-input="false"
                    size="lg"
                    class="w-full"
                  />
                </UFormField>

                <UFormField
                  name="inputEncoding"
                  label="Input encoding"
                  :ui="{ labelWrapper: 'justify-start' }"
                >
                  <template #hint>
                    <FieldInfo
                      label="Input encoding"
                      text="Choose the encoding of your input, or use Auto-detect."
                    />
                  </template>

                  <USelectMenu
                    v-model="state.inputEncoding"
                    :items="inputEncodings"
                    value-key="value"
                    :search-input="false"
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
                    type="button"
                    label="Copy"
                    icon="i-heroicons-clipboard"
                    color="neutral"
                    variant="outline"
                    disabled
                  />

                  <UButton
                    type="button"
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
      </UForm>

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
              JSON or Base64. The input encoding defaults to Auto-detect, or you
              can select it explicitly.
            </p>
            <p>
              Select a target schema, or choose the latest supported version.
              Available targets depend on the selected source version. Legacy
              output is supported for re-encoding legacy data, but reverse
              migrations to legacy are not supported.
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
