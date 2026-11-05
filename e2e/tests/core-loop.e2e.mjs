import { test, expect } from "@playwright/test";

// Each Playwright test starts with a fresh browser context/localStorage.
// The Vite dev server is intentional: ?dev=0 uses the ordinary profile,
// and ?dev=1 uses the separately prefixed developer profile.
async function profile(page, prefix = "btw-") {
  return page.evaluate((keyPrefix) => {
    const json = (name) => JSON.parse(localStorage.getItem(keyPrefix + name) ?? "[]");
    const number = (name) => Number(localStorage.getItem(keyPrefix + name) ?? "0");
    return {
      deck: json("deck-ids"),
      clears: json("cleared-stages"),
      gold: number("kingdom-gold"),
      gems: number("gems"),
      unlocked: number("unlocked-stage")
    };
  }, prefix);
}

async function openStageOne(page) {
  await page.getByRole("button", { name: "출전", exact: true }).click();
  await expect(page.locator(".stage-grid")).toBeVisible();
  await page.locator(".stage-card").first().click();
  await expect(page.locator(".battle-lobby-launch")).toBeVisible();
  await page.locator(".battle-lobby-launch").click();
  await expect(page.locator(".battle-shell")).toBeVisible();
}

test("ordinary profile: formation persists through reload and battle entry", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/?dev=0");
  await expect(page.getByRole("navigation", { name: "왕국 하단 메뉴" })).toBeVisible();
  await expect.poll(async () => (await profile(page)).deck.length).toBeGreaterThan(1);
  const initial = await profile(page);

  await page.getByRole("button", { name: "영웅", exact: true }).click();
  await page.getByRole("button", { name: /출전 편성/ }).click();
  await expect(page.locator(".formation-slot.filled")).toHaveCount(initial.deck.length);
  await page.locator(".formation-slot.filled").last().click();

  const expectedDeck = initial.deck.slice(0, -1);
  await expect.poll(async () => (await profile(page)).deck).toEqual(expectedDeck);

  await page.reload();
  await expect(page.getByRole("navigation", { name: "왕국 하단 메뉴" })).toBeVisible();
  expect((await profile(page)).deck).toEqual(expectedDeck);

  await openStageOne(page);
  await expect(page.locator(".hero-card")).toHaveCount(expectedDeck.length);
  await page.locator(".hero-card").first().click();
  await expect(page.locator(".wave-notice")).toContainText("출전!");

  const devKeys = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("btw-dev-")));
  expect(devKeys).toEqual([]);
  expect(errors).toEqual([]);
});

test("developer profile: first clear, repeat reward and reload persistence", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/?dev=1");
  await expect(page.getByRole("navigation", { name: "왕국 하단 메뉴" })).toBeVisible();
  await expect.poll(async () => (await profile(page, "btw-dev-")).deck.length).toBeGreaterThan(0);
  const before = await profile(page, "btw-dev-");

  await openStageOne(page);
  await expect(page.locator(".auto-com-control")).toContainText("AUTO OFF");
  await page.locator(".auto-com-control").click();
  await expect(page.locator(".auto-com-control")).toContainText("AUTO ON");

  // A real battle is played; no combat or reward values are mocked.
  await expect(page.locator(".result-box.victory")).toBeVisible({ timeout: 120_000 });
  await expect(page.locator(".result-box.victory")).toContainText("첫 클리어");
  await expect.poll(async () => (await profile(page, "btw-dev-")).clears).toContain(1);
  const first = await profile(page, "btw-dev-");
  expect(first.gold).toBeGreaterThan(before.gold);
  expect(first.gems).toBeGreaterThan(before.gems);

  await page.getByRole("button", { name: "다시 전투" }).click();
  await expect(page.locator(".battle-shell")).toBeVisible();
  await expect(page.locator(".result-box.victory")).toBeVisible({ timeout: 120_000 });
  await expect(page.locator(".result-box.victory")).toContainText("반복 클리어");
  await expect.poll(async () => (await profile(page, "btw-dev-")).gold).toBeGreaterThan(first.gold);
  const repeat = await profile(page, "btw-dev-");
  expect(repeat.gems).toBe(first.gems);
  expect(repeat.clears.filter(id => id === 1)).toHaveLength(1);

  await page.getByRole("button", { name: "스테이지 선택" }).click();
  await page.reload();
  await expect(page.getByRole("navigation", { name: "왕국 하단 메뉴" })).toBeVisible();
  await expect.poll(async () => (await profile(page, "btw-dev-")).clears).toContain(1);
  const restored = await profile(page, "btw-dev-");
  expect(restored.gold).toBe(repeat.gold);
  expect(restored.gems).toBe(repeat.gems);
  expect(restored.deck).toEqual(before.deck);
  expect(errors).toEqual([]);
});

test("ordinary profile: defeat without deployment grants no clear reward", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  await page.goto("/?dev=0");
  await expect(page.getByRole("navigation", { name: "왕국 하단 메뉴" })).toBeVisible();
  await openStageOne(page);
  await expect(page.locator(".auto-com-control")).toContainText("AUTO OFF");
  const before = await profile(page);

  // The battle runs at the game's existing default 5X speed.
  await expect(page.locator(".result-box.defeat")).toBeVisible({ timeout: 120_000 });
  const after = await profile(page);
  expect(after.clears).not.toContain(1);
  expect(after.gold).toBe(before.gold);
  expect(after.gems).toBe(before.gems);
  expect(errors).toEqual([]);
});
