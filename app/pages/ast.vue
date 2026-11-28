<script setup lang="ts">
import type { BreadcrumbItem } from "@nuxt/ui";

useSeoMeta({
  title: "AST explorer · Dice Roller Tools",
  description:
    "Enter dice notation and explore its parsed abstract syntax tree (AST) to see how expressions are structured.",
});

const breadcrumbs: BreadcrumbItem[] = [
  { label: "Home", icon: "i-heroicons-home", to: "/" },
  { label: "AST explorer" },
];
</script>

<template>
  <div class="relative isolate">
    <div class="ast-artwork" aria-hidden="true" />

    <UContainer class="pb-12 sm:pb-16">
      <UPageHeader
        title="AST explorer"
        description="Enter dice notation and explore its parsed abstract syntax tree (AST) to see how expressions are structured."
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

      <UCard as="section" aria-labelledby="ast-preview-heading">
        <template #header>
          <div class="flex flex-wrap items-center gap-3">
            <h2
              id="ast-preview-heading"
              class="font-serif text-xl font-semibold text-highlighted"
            >
              A preview of the AST explorer
            </h2>
            <UBadge color="neutral" variant="subtle" label="Planned" />
          </div>
        </template>

        <figure class="space-y-4">
          <UColorModeImage
            light="/images/ast-preview-light.webp"
            dark="/images/ast-preview-dark.webp"
            alt="Design concept showing a dice notation input, an expandable syntax tree for an expression containing exploding and keep-highest dice pools, and a panel displaying the selected node's details."
            width="1500"
            height="720"
            class="h-auto w-full"
          />
          <figcaption class="text-sm text-toned">
            A design concept for the planned AST explorer. The final interface
            may differ.
          </figcaption>
        </figure>
      </UCard>
    </UContainer>
  </div>
</template>

<style scoped>
.ast-artwork {
  position: absolute;
  z-index: -1;
  inset: 0 0 auto auto;
  width: min(100%, 65rem);
  height: 20rem;
  background-image: url("~/assets/images/ast-background.png");
  background-size: cover;
  background-position: center right;
  background-repeat: no-repeat;
  opacity: 0.60;
  pointer-events: none;
  mask-image:
    linear-gradient(to right, transparent, black 70%),
    linear-gradient(to bottom, black 20%, transparent);
  mask-composite: intersect;
}

:global(html:not(.dark) .ast-artwork) {
  opacity: 0.23
}
</style>
