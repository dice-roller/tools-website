# Agent instructions

## Project conventions

This website provides browser-based tools for RPG Dice Roller. It uses Nuxt 4, Vue 3, Nuxt UI and Tailwind CSS 4. Production is a static GitHub Pages deployment.

- Always use existing Nuxt UI components when a suitable component is available. Check the [Nuxt UI component catalogue](https://ui.nuxt.com/docs/components) and the installed version before implementing a control or layout. Only build custom components when the library cannot meet the requirements; compose Nuxt UI components or use native HTML where appropriate.
- Use Nuxt conventions for pages, layouts, components and composables. Keep the site compatible with static generation and both root and repository base paths.
- Use semantic Nuxt UI colour tokens and existing theme settings instead of hard-coded colours. Keep theme changes centralised.
- Consult the [Dice Roller documentation](https://dice-roller.github.io/documentation/) and [library source](https://github.com/dice-roller/rpg-dice-roller) when working on dice notation, results or conversion.

## Accessibility is a requirement

Games should be for everyone. Follow [CONTRIBUTING.md](CONTRIBUTING.md), and target WCAG 2.2 Level AA for every page and interactive state.

- Preserve semantic HTML, meaningful landmarks, logical headings and accessible names. Associate labels, descriptions and errors with form fields. Prefer native semantics and the accessibility behaviour supplied by Nuxt UI over redundant ARIA.
- Make all interactions keyboard accessible, with visible focus, a logical focus order, focus restoration for overlays and a way to skip repeated navigation.
- Ensure adequate text and non-text contrast in light and dark mode. Do not convey information solely through colour, icons or visual layout. Respect reduced motion, zoom, reflow and minimum target sizes.
- Provide meaningful text alternatives for dice results and diagrams, and accessible status/error announcements. Make the AST explorer's structure accessible without relying on its visual representation.
- Extend Playwright and axe-core coverage for new routes and interactive states. Never disable an accessibility rule or exclude an element simply to pass CI. Document any justified exception and its follow-up.
- Automated checks are not proof of WCAG conformance. Review keyboard operation, focus, screen reader behaviour, contrast, zoom and reduced motion manually where relevant; state any unverified behaviours.

## Validation

Run `npm run lint`, `npm run typecheck` and `npm run test:e2e` before proposing changes. The end-to-end suite builds and serves the static website. Install Chromium using `npx playwright install chromium` if needed.

Report failures, limitations and any checks that could not be performed. Do not claim validation that was not run.
