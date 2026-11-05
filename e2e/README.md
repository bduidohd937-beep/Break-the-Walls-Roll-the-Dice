# BTWRD browser regression tests

Browser tests live in this isolated directory. They do not change production game code,
balance, save keys or stage data.

## Local execution

From the repository root:

```sh
npm ci
npm install --prefix e2e --no-package-lock
cd e2e
npx playwright install chromium
npx playwright test
```

Playwright starts the existing Vite dev server on http://127.0.0.1:4173.

- `/?dev=0` checks an **ordinary** player profile.
- `/?dev=1` checks a **developer** profile.
- Playwright creates a fresh browser context for each test; it never loads a real
  user's profile. No production origin is contacted.
- The first/repeat clear test runs a real battle. It intentionally does **not**
  bypass enemy HP or change the temporary balance.
- A failing clear test may reveal a gameplay/balance issue instead of a test
  infrastructure issue; investigate before changing game logic.

The dedicated e2e manifest pins Playwright; the root package manifest and lockfile
are unchanged. CI installs e2e dependencies separately without generating a lockfile.

## Covered scenarios

1. Ordinary profile: remove a formation member, verify saved deck, reload, enter
   stage one and deploy a hero; verify no developer-profile keys were written.
2. Developer profile: clear stage one, observe first-clear rewards, replay it,
   observe repeat-clear rewards without extra gems, reload and verify saved data.
3. Ordinary profile: lose stage one with no heroes deployed and verify that
   rewards and clear history were not granted.

## Scope boundary

No production game source, save format, content IDs, stage flags, boss placement,
skill rules or balance numbers are modified by these tests.
