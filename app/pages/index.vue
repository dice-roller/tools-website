<script setup lang="ts">
import type { ButtonProps } from "@nuxt/ui";
import { tools } from "~/data/tools";

const documentationUrl = useRuntimeConfig().public.documentationBaseUrl;

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
  <div class="relative isolate">
    <div class="home-hero-artwork" aria-hidden="true" />

    <UPageHero
      class="home-hero"
      title="Your dice. Your tools."
      description="A growing collection of free, open-source utilities for RPG Dice Roller."
      :links="links"
      :ui="{
        container: 'py-16 sm:py-20 lg:py-24',
        title: 'font-serif',
        description: 'text-toned',
        footer: 'mt-8',
      }"
    />

    <UContainer class="py-8 sm:pb-16">
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
            :highlight="!!tool.path"
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
              <div class="flex flex-wrap items-center justify-between gap-2">
                <UBadge
                  v-if="tool.status"
                  color="neutral"
                  variant="subtle"
                  :label="tool.status"
                />
                <UButton
                  v-if="tool.path"
                  :to="tool.path"
                  :label="`Open ${tool.title.toLowerCase()}`"
                  trailing-icon="i-heroicons-arrow-right"
                  variant="link"
                />
              </div>
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

<style scoped>
.home-hero-artwork {
  position: absolute;
  z-index: -1;
  top: 0;
  left: 50%;
  width: min(100%, 85rem);
  translate: -50% 0;
  height: 25rem;
  background-image: url("~/assets/images/home-background.png");
  background-size: auto 100%;
  background-position-x: center;
  background-position-y: bottom;
  background-repeat: no-repeat;
  opacity: 0.75;
  pointer-events: none;
  mask-image: linear-gradient(to bottom, black 20%, transparent);
  mask-composite: intersect;
}

:global(html:not(.dark) .home-hero-artwork) {
  opacity: 0.23;
}
</style>
