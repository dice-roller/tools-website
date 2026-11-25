<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";
import { documentationUrl, repositoryUrl, tools } from "~/data/tools";

const items: NavigationMenuItem[] = [
  { label: "Home", to: "/", exact: true },
  {
    label: "Tools",
    children: tools.map((tool) => ({
      label: tool.title,
      description: tool.status,
      icon: tool.icon,
      to: { path: "/", hash: `#${tool.id}` },
    })),
  },
  { label: "Documentation", to: documentationUrl, target: "_blank" },
];

const mobileItems: NavigationMenuItem[] = [
  { label: "Home", to: "/", exact: true },
  ...tools.map((tool) => ({
    label: tool.title,
    icon: tool.icon,
    to: { path: "/", hash: `#${tool.id}` },
  })),
  { label: "Documentation", to: documentationUrl, target: "_blank" },
];
</script>

<template>
  <div>
    <UHeader title="Dice Roller Tools">
      <template #title>
        <SiteLogo />
      </template>

      <UNavigationMenu :items="items" />

      <template #right>
        <UButton
          :to="repositoryUrl"
          target="_blank"
          color="neutral"
          variant="ghost"
          icon="i-lucide-github"
          aria-label="GitHub repository"
        />
        <UColorModeButton />
      </template>

      <template #body>
        <UNavigationMenu
          :items="mobileItems"
          orientation="vertical"
          class="-mx-2.5"
        />
      </template>
    </UHeader>

    <UMain>
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
          :to="repositoryUrl"
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
