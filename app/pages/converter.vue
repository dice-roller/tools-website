<script setup lang="ts">
import { downloadFile } from "~/utils/download-file";
import {
  convert,
  detectVersion,
  getSupportedFormats,
  getSupportedTargetVersions,
  getSupportedVersions,
  supportedEncodings,
} from "@dice-roller/convertor";
import type {
  ConversionWarning,
  DataVersion,
  ResultFormat,
  SupportedDataVersion,
  TargetVersion,
} from "@dice-roller/convertor";
import type {
  AccordionItem,
  BreadcrumbItem,
  FormError,
  FormErrorEvent,
} from "@nuxt/ui";
import { legacyExample } from "~/data/converter-example";

definePageMeta({ toolArtwork: true });

// Prerendered controls must not accept input before their Vue handlers exist.
const formReady = ref(false);
onMounted(() => {
  formReady.value = true;
});

const { documentationBaseUrl } = useRuntimeConfig().public;
const converterDocumentationUrl = new URL(
  "guide/packages/converter",
  `${documentationBaseUrl.replace(/\/+$/, "")}/`,
).href;

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

const detectedSource = computed(() => {
  const input = state.input.trim();
  if (!input) return undefined;

  try {
    const version = detectVersion(input);
    // Only inspect the envelope discriminator. The library owns decoding
    // and validation of roll data, including legacy Base64 text.
    const envelope = JSON.parse(input.startsWith("{") ? input : atob(input));
    return {
      version,
      history: envelope.type === "dice-roller" || envelope.type === "history",
    };
  } catch {
    return undefined;
  }
});

const detectedSourceHelp = computed(() => {
  if (state.sourceVersion !== "auto" || !detectedSource.value) {
    return undefined;
  }
  const { version } = detectedSource.value;
  const supported = supportedVersions.some((item) => item === version);
  return `Detected: ${versionLabel(version)}${supported ? "" : " (unsupported)"}`;
});

const targetVersions = computed(() => {
  const source =
    state.sourceVersion === "auto"
      ? detectedSource.value?.version
      : state.sourceVersion;
  const versions =
    source !== undefined && !supportedVersions.some((item) => item === source)
      ? []
      : getSupportedTargetVersions(source);
  const items: { label: string; value: TargetVersion }[] = versions.map(
    (version) => ({ label: versionLabel(version), value: version }),
  );

  if (versions.some((version) => version === latestVersion)) {
    items.push({ label: "Latest supported", value: "latest" });
  }

  return items;
});

const formats = computed(() =>
  getSupportedFormats(state.targetVersion)
    .filter((value) => !detectedSource.value?.history || value === "full")
    .map((value) => ({
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
  if (
    items.length &&
    !items.some((item) => item.value === state.targetVersion)
  ) {
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

const output = ref("");
const warnings = ref<ConversionWarning[]>([]);
const error = ref("");
const status = ref("");
const statusColor = ref<"success" | "warning">("success");
const statusDuration = 5000;
let statusTimer: ReturnType<typeof setTimeout> | undefined;
const feedback = ref<HTMLElement | null>(null);
const outputHeading = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const readingFile = ref(false);
const uploadedFilename = ref("");

function clearStatus() {
  clearTimeout(statusTimer);
  statusTimer = undefined;
  status.value = "";
  statusColor.value = "success";
}

function showStatus(
  message: string,
  color: "success" | "warning" = "success",
  persistent = false,
) {
  clearStatus();
  status.value = message;
  statusColor.value = color;
  if (!persistent) {
    statusTimer = setTimeout(clearStatus, statusDuration);
  }
}

onBeforeUnmount(clearStatus);

function clearResult() {
  output.value = "";
  warnings.value = [];
  error.value = "";
  clearStatus();
}

watch(state, clearResult);

function validate(): FormError[] {
  const input = state.input.trim();
  if (!input) {
    return [
      { name: "input", message: "Enter some exported dice roller data." },
    ];
  }

  // The library detects encoding itself. Explicit choices constrain what
  // we pass to it, without decoding or changing legacy Base64 text.
  if (state.inputEncoding === "json" && !input.startsWith("{")) {
    return [{ name: "input", message: "Expected a JSON export object." }];
  }

  if (
    state.inputEncoding === "base64" &&
    (input.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input))
  ) {
    return [{ name: "input", message: "Expected Base64-encoded export data." }];
  }

  return [];
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "An unexpected error occurred.";
}

async function revealFeedback() {
  await nextTick();
  if (window.matchMedia("(max-width: 1023px)").matches) {
    feedback.value?.scrollIntoView({ block: "start" });
  }
}

async function onValidationError(event: FormErrorEvent) {
  await nextTick();
  const id = event.errors[0]?.id;
  const field = id ? document.getElementById(id) : null;
  // UForm may still be releasing its submission state on the first tick.
  // The next animation frame runs after the controls have been re-enabled.
  requestAnimationFrame(() => {
    const input = document.querySelector<HTMLElement>('[name="input"]');
    const target = field ?? input;
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "center" });
  });
}

function jumpToOutput() {
  outputHeading.value?.focus();
  outputHeading.value?.scrollIntoView({ block: "start" });
}

async function onSubmit() {
  clearResult();

  try {
    const collectedWarnings: ConversionWarning[] = [];
    const result = convert(state.input.trim(), state.targetVersion, {
      from: state.sourceVersion === "auto" ? undefined : state.sourceVersion,
      format: state.format,
      encoding: state.encoding,
      strict: state.strict,
      onWarning: (warning) => collectedWarnings.push(warning),
    });

    output.value =
      state.encoding === "json"
        ? JSON.stringify(JSON.parse(result), null, 2)
        : result;
    warnings.value = collectedWarnings;
    showStatus(
      collectedWarnings.length
        ? "Conversion complete with warnings."
        : "Conversion complete.",
      collectedWarnings.length ? "warning" : "success",
    );
  } catch (cause) {
    error.value = errorMessage(cause);
  }

  await revealFeedback();
}

function setInput(input: string, filename = "") {
  clearResult();
  state.input = input;
  uploadedFilename.value = filename;
  state.sourceVersion = "auto";
  state.inputEncoding = "auto";
}

function loadExample() {
  setInput(JSON.stringify(legacyExample, null, 2));
}

async function uploadFile(event: Event) {
  const element = event.target as HTMLInputElement;
  const file = element.files?.[0];
  element.value = "";
  if (!file) return;

  readingFile.value = true;
  try {
    setInput(await file.text(), file.name);
  } catch (cause) {
    error.value = `Could not read the file: ${errorMessage(cause)}`;
    await revealFeedback();
  } finally {
    readingFile.value = false;
  }
}

async function copyOutput() {
  if (!output.value) return;

  try {
    await navigator.clipboard.writeText(output.value);
    showStatus("Converted data copied to clipboard.");
  } catch {
    showStatus(
      "Could not copy automatically. Select and copy the output manually.",
      "warning",
      true,
    );
  }

  await revealFeedback();
}

async function downloadOutput() {
  if (!output.value) return;

  const json = state.encoding === "json";
  const blob = new Blob([output.value], {
    type: json ? "application/json" : "text/plain;charset=utf-8",
  });
  const stem =
    uploadedFilename.value.replace(/\.[^.]+$/, "") || "converted-roll";
  const target =
    state.targetVersion === "latest" ? latestVersion : state.targetVersion;
  const version = target === "legacy" ? "v5" : `schema-${target}`;
  downloadFile(
    blob,
    `${stem}-${version}-${state.format}.${json ? "json" : "txt"}`,
  );
  showStatus("Download started.");
  await revealFeedback();
}

const help: AccordionItem[] = [
  { label: "Supported formats and conversion options", value: "formats" },
];
</script>

<template>
  <div class="relative isolate">
    <div class="tool-artwork" aria-hidden="true" />

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
          :validate="validate"
          aria-labelledby="conversion-options-heading"
          @submit="onSubmit"
          @error="onValidationError"
        >
          <fieldset :disabled="!formReady" class="min-w-0 flex flex-col">
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
                    :disabled="!targetVersions.length"
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
                  :disabled="readingFile"
                  class="justify-center sm:col-span-2 lg:col-span-1"
                />
              </div>
            </UCard>

            <div ref="feedback" class="scroll-mt-24">
              <FeedbackTransition :show="!!error" @after-enter="revealFeedback">
                <UAlert
                  role="alert"
                  color="error"
                  variant="subtle"
                  icon="i-heroicons-exclamation-circle"
                  title="Conversion failed"
                  :description="error"
                />
              </FeedbackTransition>

              <FeedbackTransition
                :show="!!warnings.length"
                @after-enter="revealFeedback"
              >
                <UAlert
                  color="warning"
                  variant="subtle"
                  icon="i-heroicons-exclamation-triangle"
                  title="Conversion warnings"
                >
                  <template #description>
                    <ul class="list-disc space-y-1 ps-4">
                      <li v-for="(warning, index) in warnings" :key="index">
                        {{ warning.path }}: {{ warning.message }}
                      </li>
                    </ul>
                  </template>
                </UAlert>
              </FeedbackTransition>

              <div role="status" aria-label="Conversion status">
                <FeedbackTransition
                  :show="!!status"
                  @after-enter="revealFeedback"
                >
                  <UAlert
                    :color="statusColor"
                    variant="subtle"
                    :icon="
                      statusColor === 'success'
                        ? 'i-heroicons-check-circle'
                        : 'i-heroicons-exclamation-triangle'
                    "
                    :title="status"
                  />
                </FeedbackTransition>
              </div>

              <div class="lg:hidden">
                <FeedbackTransition :show="!!output">
                  <UButton
                    type="button"
                    label="View converted output"
                    trailing-icon="i-heroicons-arrow-down"
                    color="neutral"
                    variant="outline"
                    @click="jumpToOutput"
                  />
                </FeedbackTransition>
              </div>
            </div>

            <div class="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <UCard
                as="section"
                aria-labelledby="converter-input-heading"
                class="min-w-0"
              >
                <template #header>
                  <div
                    class="flex flex-wrap items-center justify-between gap-3"
                  >
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
                        :disabled="readingFile"
                        :loading="readingFile"
                        @click="fileInput?.click()"
                      />

                      <UButton
                        type="button"
                        label="Load example"
                        icon="i-lucide-flask-conical"
                        color="neutral"
                        variant="outline"
                        :disabled="readingFile"
                        @click="loadExample"
                      />
                    </div>
                  </div>
                </template>

                <input
                  ref="fileInput"
                  type="file"
                  accept=".json,.txt,.base64,application/json,text/plain"
                  hidden
                  @change="uploadFile"
                />

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
                      :disabled="readingFile"
                      placeholder="Paste your JSON or Base64 export here…"
                      :rows="9"
                      class="w-full font-mono"
                      :ui="{ base: 'min-h-48 resize-y' }"
                      spellcheck="false"
                      autocapitalize="off"
                      @update:model-value="uploadedFilename = ''"
                    />
                  </UFormField>

                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <UFormField
                      name="sourceVersion"
                      label="Source version"
                      :help="detectedSourceHelp"
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
                  <div
                    class="flex flex-wrap items-center justify-between gap-3"
                  >
                    <h2
                      id="converter-output-heading"
                      ref="outputHeading"
                      tabindex="-1"
                      class="scroll-mt-24 font-serif text-2xl font-semibold text-highlighted"
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
                        :disabled="!output"
                        @click="copyOutput"
                      />

                      <UButton
                        type="button"
                        label="Download"
                        icon="i-lucide-download"
                        color="neutral"
                        variant="outline"
                        :disabled="!output"
                        @click="downloadOutput"
                      />
                    </div>
                  </div>
                </template>

                <div class="relative min-h-64 flex-1">
                  <UTextarea
                    v-if="output"
                    :model-value="output"
                    aria-label="Converted data"
                    readonly
                    class="absolute inset-0 font-mono"
                    :ui="{ base: 'h-full resize-none' }"
                    spellcheck="false"
                  />
                  <UEmpty
                    v-else
                    icon="i-heroicons-document"
                    description="Your converted data will appear here."
                    variant="subtle"
                    size="xl"
                    class="absolute inset-0"
                  />
                </div>
              </UCard>
            </div>
          </fieldset>
        </UForm>

        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-heroicons-shield-check"
          title="Conversion runs locally. No data is uploaded."
        />

        <UCard :ui="{ body: 'py-0 sm:py-0' }">
          <UAccordion
            :items="help"
            :ui="{ trigger: 'py-4 text-base', body: 'space-y-3 text-toned' }"
          >
            <template #body>
              <p>
                Legacy (v5) exports and version 1 (v6) exports can be supplied
                as JSON or Base64. The input encoding defaults to Auto-detect,
                or you can select it explicitly.
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
                Available output formats are restricted automatically for
                histories.
              </p>
              <p>
                Strict conversion rejects ambiguous or inconsistent data.
                Best-effort conversion can recover some inconsistencies and
                returns warnings.
              </p>
            </template>
          </UAccordion>
        </UCard>

        <UCard as="section" aria-labelledby="converter-library-heading">
          <div class="space-y-3">
            <h2
              id="converter-library-heading"
              class="font-serif text-xl font-semibold text-highlighted"
            >
              Use the converter in your own project
            </h2>
            <p class="text-toned">
              This tool uses the open-source RPG Dice Roller Convertor library.
              You can install the same library in your own JavaScript or
              TypeScript project to convert exports programmatically.
            </p>

            <pre
              class="rounded-md bg-elevated p-3 text-sm wrap-anywhere whitespace-pre-wrap text-highlighted"
            ><code>npm install @dice-roller/convertor</code></pre>

            <div class="flex flex-wrap gap-2">
              <UButton
                :to="converterDocumentationUrl"
                target="_blank"
                label="Converter documentation"
                icon="i-lucide-book-open"
                trailing-icon="i-heroicons-arrow-up-right"
                color="neutral"
                variant="outline"
              />
              <UButton
                to="https://github.com/dice-roller/convertor"
                target="_blank"
                label="View on GitHub"
                icon="i-lucide-github"
                trailing-icon="i-heroicons-arrow-up-right"
                color="neutral"
                variant="link"
              />
            </div>
          </div>
        </UCard>
      </div>
    </UContainer>
  </div>
</template>

<style scoped>
.tool-artwork {
  position: absolute;
  z-index: -1;
  inset: 0 0 auto auto;
  width: min(100%, 65rem);
  height: 20rem;
  background-image: url("~/assets/images/converter-background.png");
  background-size: cover;
  background-position: center right;
  background-repeat: no-repeat;
  opacity: 0.75;
  pointer-events: none;
  mask-image:
    linear-gradient(to right, transparent, black 70%),
    linear-gradient(to bottom, black 20%, transparent);
  mask-composite: intersect;
}

:global(html:not(.dark) .tool-artwork) {
  opacity: 0.23;
}
</style>
