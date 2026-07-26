import { test, expect } from '@playwright/test';

test('homepage renders hero and has no horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=龙渊天青').first()).toBeVisible();

  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  expect(hasOverflow).toBe(false);
});
