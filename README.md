# Dice Roller Tools website

The standalone website for browser-based [RPG Dice Roller](https://github.com/dice-roller/rpg-dice-roller) tools, built with Nuxt 4, Vue 3, Nuxt UI and Tailwind CSS 4.

## Development

Use Node.js 24 (see `.nvmrc`) and npm.

```sh
npm ci
npm run dev
```

Nuxt generates its TypeScript and ESLint configuration during installation (`nuxt prepare`). Use `npm run typecheck` to check TypeScript and Vue templates, `npm run lint` to check linting and formatting, and `npm run format` to format source files.

```sh
npm run generate
npm run preview
```

The static production website is generated in `.output/public/`. The GitHub Pages preset is configured in Nuxt; no Node.js server is needed in production.

## Structure and routing

- `app/app.vue`: the application entry, wrapped in Nuxt UI's `UApp` provider.
- `app/layouts/default.vue`: shared site header, navigation and footer.
- `app/pages/index.vue`: the homepage.
- `app/data/tools.ts`: the tool catalogue and shared external links.
- `app/app.config.ts`: Nuxt UI semantic colours and icons.
- `app/assets/css/main.css`: shared Tailwind CSS and Nuxt UI styles.
- `nuxt.config.ts`: framework, module and static hosting configuration.

The homepage uses Nuxt UI's Parchment preset (palette and tokens in `app/assets/css/main.css`, semantic colours and icons in `app/app.config.ts`). Fonts are bundled locally. The existing documentation logo is reused from the [documentation repository](https://github.com/dice-roller/documentation/blob/next/docs/public/dice-roller-logo.png); the current artwork derived from [Font Awesome](https://fontawesome.com/license/free) is retained pending its replacement. The hero background is a WebP-optimised copy of the [documentation artwork](https://github.com/dice-roller/documentation/blob/next/docs/.vitepress/theme/home-background.png), with a theme-aware overlay for text legibility. No individual tools are implemented yet.

Nuxt automatically creates routes from Vue files in `app/pages/`. For example, `app/pages/index.vue` becomes `/` and `app/pages/converter.vue` becomes `/converter`. Use `NuxtLink` for internal navigation. Components, layouts and composables can live in `app/components/`, `app/layouts/` and `app/composables/` respectively.

See the [Nuxt documentation](https://nuxt.com/docs/4.x/getting-started/introduction) and [Nuxt UI component catalogue](https://ui.nuxt.com/docs/components).

## Accessibility and contributing

Accessibility is a core project requirement. See [CONTRIBUTING.md](CONTRIBUTING.md) for our WCAG 2.2 AA target, manual review expectations and Playwright/axe-core tests.

```sh
npx playwright install chromium
npm run test:e2e
```

The end-to-end tests generate and serve the static website automatically.

## Publishing

The Publish website workflow generates and deploys static files to GitHub Pages whenever `main` is updated. It can also be run manually from `main`. Other branches and pull requests run CI without publishing.

Before the first deployment:

1. Open the repository's Settings → Pages and set the publishing source to GitHub Actions.
2. Ensure the organisation's GitHub plan supports Pages for private repositories. The published website may be public even though its source repository is private.
3. When ready to use the custom domain, configure `tools.dice-roller.dev` in Pages settings and add a DNS CNAME record for `tools` pointing to `dice-roller.github.io`. Enable HTTPS once DNS has been verified.

The workflow sets `NUXT_APP_BASE_URL` from the Pages configuration, including the trailing slash. This supports both the default project URL and the custom domain. No separate publishing branch is required.
