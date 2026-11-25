<script setup lang="ts">
import type { ButtonProps } from "@nuxt/ui";
import { documentationUrl, tools } from "~/data/tools";

useSeoMeta({
  title: "Dice Roller Tools",
  description:
    "A growing collection of free, open-source utilities for RPG Dice Roller.",
});

const links: ButtonProps[] = [
  {
    label: "Explore the tools",
    to: "#tools",
    trailingIcon: "i-heroicons-arrow-down",
  },
  {
    label: "Read the docs",
    to: documentationUrl,
    target: "_blank",
    color: "neutral",
    variant: "outline",
    trailingIcon: "i-heroicons-arrow-up-right",
  },
];
</script>

<template>
  <div>
    <UPageHero
      title="Your dice. Your tools."
      description="A growing collection of free, open-source utilities for RPG Dice Roller."
      :links="links"
      :ui="{
        container: 'py-16 sm:py-20 lg:py-24',
        title: 'font-serif',
        footer: 'mt-8',
      }"
    />

    <UContainer class="pb-12 sm:pb-16">
      <section
        id="tools"
        aria-labelledby="tools-heading"
        class="scroll-mt-24 space-y-6"
      >
        <div class="flex items-center gap-4">
          <h2
            id="tools-heading"
            class="font-serif text-2xl font-semibold text-highlighted sm:text-3xl"
          >
            Explore the tools
          </h2>
          <USeparator class="flex-1" />
        </div>

        <UPageGrid>
          <UPageCard
            v-for="tool in tools"
            :id="tool.id"
            :key="tool.id"
            :as="{ root: 'article', title: 'h3' }"
            :title="tool.title"
            :description="tool.description"
            :highlight="tool.status === 'Coming soon'"
            class="scroll-mt-24"
            :ui="{
              title: 'font-serif text-xl',
              description: 'mt-2',
              leading: 'rounded-lg bg-elevated p-2.5',
              leadingIcon: 'size-7',
            }"
            :icon="tool.icon"
          >
            <template #footer>
              <UBadge color="neutral" variant="subtle" :label="tool.status" />
            </template>
          </UPageCard>
        </UPageGrid>

        <UAlert
          color="neutral"
          variant="subtle"
          icon="i-heroicons-shield-check"
          title="Built for privacy"
          description="The tools are designed to run in your browser, without uploading your dice data to a server."
          :ui="{ title: 'font-serif text-lg font-semibold', icon: 'size-7' }"
          class="mt-8"
        />
      </section>
    </UContainer>
  </div>
</template>
