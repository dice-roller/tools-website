# Contributing

Games should be for everyone. Accessibility is a core requirement of the Dice Roller Tools website, not an optional enhancement.

## Accessibility

Aim for [WCAG 2.2 Level AA](https://www.w3.org/TR/WCAG22/) on every page and in every interactive state.

- Prefer Nuxt UI components and their built-in keyboard and screen reader behaviour over custom controls. Use native HTML when it is simpler or more appropriate; do not add ARIA when native semantics already express the same information.
- Use meaningful landmarks, logical heading levels, descriptive links, accessible names for icon-only controls, and properly associated form labels, instructions and errors.
- Ensure all functionality works with a keyboard. Maintain visible focus, sensible focus order, focus restoration after overlays close, and an accessible way to bypass repeated navigation.
- Do not rely on colour, icons, layout or animation alone to convey information. Check contrast in both light and dark modes, including focus states and interactive controls. Respect reduced-motion preferences.
- Support text resizing, zoom and reflow on narrow screens. Interactive targets must meet the WCAG 2.2 AA minimum target size criterion (including its exceptions).
- Provide text equivalents for visual dice results and diagrams. Announce completed conversions, roll results and validation errors using appropriate live regions without moving focus unnecessarily or making excessive announcements.
- Make the AST explorer usable without relying on a graphical tree. Offer a semantic, keyboard-accessible representation of its structure.

## Development checks

```sh
npm ci
npm run lint
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

On Linux, use `npx playwright install --with-deps chromium` if browser system dependencies are missing.

Playwright generates and serves the static website locally. The tests use axe-core's WCAG 2.0, 2.1 and 2.2 Level A/AA tags and check keyboard interaction, both colour modes and mobile navigation. CI runs these checks automatically.

When adding a page or interactive state, extend the tests to cover it. Do not suppress axe rules or exclude failing elements just to make CI pass; fix the underlying issue, or document a narrowly scoped exception with a reason and follow-up issue.

Automated tests cannot establish WCAG conformance on their own. Before merging changes that affect the interface, also review keyboard navigation, screen reader announcements, zoom and reflow, contrast, focus and reduced motion manually. Test with actual assistive technology when appropriate (for example, NVDA with Firefox or VoiceOver with Safari).

## Pull requests

Explain what changed, how it was tested and any known accessibility limitations. These requirements apply to all contributions, including AI-generated code.

See the [README](README.md) for the development and publishing setup.
