<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
import { githubOrganisationUrl, tools } from "~/data/tools";

const documentationUrl = useRuntimeConfig().public.documentationBaseUrl;

const items = tools.map((tool) => ({
  label: tool.title,
  icon: tool.icon,
  to: tool.path ?? { path: "/", hash: `#${tool.id}` },
  exactHash: true,
  badge: tool.status && { label: tool.status, variant: "subtle", size: "xs" },
})) satisfies NavigationMenuItem[];
</script>

<template>
  <div class="relative isolate">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-100 focus:rounded-md focus:bg-default focus:p-3 focus:text-highlighted"
    >
      Skip to main content
    </a>
    <UHeader title="Dice Roller Tools">
      <template #title>
        <SiteLogo />
      </template>

      <UNavigationMenu as="nav" aria-label="Main navigation" :items="items" />

      <template #right>
        <UButton
          :to="documentationUrl"
          target="_blank"
          label="Documentation"
          color="neutral"
          variant="ghost"
          class="hidden lg:inline-flex"
        />
        <UButton
          :to="githubOrganisationUrl"
          target="_blank"
          color="neutral"
          variant="ghost"
          icon="i-lucide-github"
          aria-label="Dice Roller on GitHub"
        />
        <UColorModeButton />
      </template>

      <template #body>
        <UNavigationMenu
          as="nav"
          aria-label="Mobile navigation"
          :items="items"
          orientation="vertical"
          class="-mx-2.5"
        />
        <UButton
          :to="documentationUrl"
          target="_blank"
          label="Documentation"
          trailing-icon="i-heroicons-arrow-up-right"
          color="neutral"
          variant="ghost"
          class="mt-2"
        />
      </template>
    </UHeader>

    <UMain id="main-content" tabindex="-1" class="scroll-mt-20">
      <slot />
    </UMain>

    <UFooter class="border-t border-default">
      <template #left>
        <NuxtLink to="/" aria-label="Dice Roller Tools home">
          <SiteLogo />
        </NuxtLink>
      </template>
      <template #right>
        <UButton
          :to="documentationUrl"
          target="_blank"
          color="neutral"
          variant="link"
          label="Documentation"
          trailing-icon="i-heroicons-arrow-up-right"
        />
        <UButton
          :to="githubOrganisationUrl"
          target="_blank"
          color="neutral"
          variant="link"
          label="GitHub"
          trailing-icon="i-heroicons-arrow-up-right"
        />
      </template>
    </UFooter>
  </div>
</template>
