<script setup lang="ts">
import type { PresenterOptionField } from "~/data/presenter-options";

const props = defineProps<{
  fields: readonly PresenterOptionField[];
  values: Record<string, unknown>;
  prefix: string;
  isChild?: boolean;
}>();
const emit = defineEmits<{
  update: [values: Record<string, unknown>];
}>();

function update(key: string, value: unknown) {
  emit("update", { ...props.values, [key]: value });
}

function groupValues(key?: string): Record<string, unknown> {
  if (!key) return props.values;
  const value = props.values[key];
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function updateGroup(key: string | undefined, values: Record<string, unknown>) {
  if (key) update(key, values);
  else emit("update", values);
}

function disabled(field: Exclude<PresenterOptionField, { type: "group" }>) {
  const condition = field.disabledWhen;
  return condition ? props.values[condition.key] === condition.equals : false;
}

function numberValue(key: string) {
  const value = props.values[key];
  return typeof value === "number" ? value : undefined;
}

function updateNumber(
  field: Extract<PresenterOptionField, { type: "number" }>,
  value: number | null | undefined,
) {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= field.minimum &&
    (field.maximum === undefined || value <= field.maximum)
  ) {
    update(field.key, value);
  }
}
</script>

<template>
  <div :class="{ 'space-y-6': !isChild, 'space-y-3': isChild }">
    <template v-for="field in fields" :key="field.key ?? field.label">
      <template v-if="field.type === 'group'">
        <UAccordion
          v-if="field.collapsible"
          :items="[{ label: field.label, slot: 'fields' }]"
          class="rounded-md border border-default px-3"
          :ui="{ body: 'pb-3' }"
        >
          <template #fields-body>
            <div class="space-y-2">
              <div
                v-if="field.description"
                class="flex items-center justify-end"
              >
                <FieldInfo :label="field.label" :text="field.description" />
              </div>
              <PresenterOptionFields
                :fields="field.fields"
                :values="groupValues(field.key)"
                :prefix="field.key ? prefix + '.' + field.key : prefix"
                @update="updateGroup(field.key, $event)"
              />
            </div>
          </template>
        </UAccordion>
        <fieldset v-else>
          <legend class="mb-2 text-sm font-bold text-highlighted">
            {{ field.label }}
          </legend>

          <PresenterOptionFields
            :fields="field.fields"
            :values="groupValues(field.key)"
            :prefix="field.key ? prefix + '.' + field.key : prefix"
            is-child
            @update="updateGroup(field.key, $event)"
          />
        </fieldset>
      </template>

      <UFormField
        v-else
        :name="prefix + '.' + field.key"
        :label="field.label"
        :orientation="field.type === 'boolean' ? 'horizontal' : 'vertical'"
        :ui="{
          root: field.type === 'boolean' ? 'items-center' : '',
          labelWrapper: 'justify-start gap-1',
        }"
      >
        <template v-if="field.description" #hint>
          <FieldInfo :label="field.label" :text="field.description" />
        </template>
        <USwitch
          v-if="field.type === 'boolean'"
          :model-value="Boolean(values[field.key])"
          size="xl"
          :disabled="disabled(field)"
          @update:model-value="update(field.key, $event)"
        />
        <UInputNumber
          v-else-if="field.type === 'number'"
          :model-value="numberValue(field.key)"
          size="lg"
          :min="field.minimum"
          :max="field.maximum"
          :disabled="disabled(field)"
          :disable-wheel-change="true"
          class="w-full"
          @update:model-value="updateNumber(field, $event)"
        />
        <USelectMenu
          v-else-if="field.type === 'select'"
          :model-value="String(values[field.key] ?? '')"
          :items="field.items"
          value-key="value"
          :search-input="false"
          :disabled="disabled(field)"
          class="w-full"
          @update:model-value="update(field.key, $event)"
        />
        <PresenterColourInput
          v-else-if="field.type === 'colour'"
          :model-value="String(values[field.key] ?? '')"
          :label="field.label"
          :disabled="disabled(field)"
          @update:model-value="update(field.key, $event)"
        />
        <UInput
          v-else
          :model-value="String(values[field.key] ?? '')"
          :disabled="disabled(field)"
          class="w-full font-mono"
          @update:model-value="update(field.key, $event)"
          @keydown.enter.prevent
        />
      </UFormField>
    </template>
  </div>
</template>
