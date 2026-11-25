// https://nuxt.com/docs/4.x/api/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxt/ui"],
  css: ["~/assets/css/main.css"],
  compatibilityDate: "2026-06-30",
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: "en-GB" },
      title: "Dice Roller Tools",
    },
  },
  ui: {
    // Parchment fonts are bundled locally via Fontsource.
    fonts: false,
  },
  nitro: {
    preset: "github_pages",
  },
});
