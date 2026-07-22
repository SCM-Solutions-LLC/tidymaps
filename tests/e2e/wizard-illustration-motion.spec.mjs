import { test, expect } from 'playwright/test';

test.use({
  viewport: { width: 1280, height: 800 },
  reducedMotion: 'no-preference',
});

test('every visible illustration contains motion that changes rendered pixels', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('#screen-landing .btn-primary').first().click();
  await expect(page.locator('#room-cards .room-card')).toHaveCount(4);
  await page.waitForTimeout(650);

  const metrics = await page.locator('#room-cards .room-card').evaluateAll((cards) =>
    cards.map((card) => {
      const targets = [...card.querySelectorAll('.art-motion, .art-motion *')];
      const target = targets.find((node) => node.getAnimations().length > 0);
      if (!target) return { label: card.textContent.trim(), animated: false };

      const animation = target.getAnimations()[0];
      const timing = animation.effect.getTiming();
      const duration = Number(timing.duration);
      const phaseTime = (progress) => Math.max(0, -Number(timing.delay || 0) + duration * progress);
      animation.pause();

      animation.currentTime = phaseTime(0);
      const startBox = target.getBoundingClientRect();
      const startStyle = getComputedStyle(target);
      const start = {
        x: startBox.x,
        y: startBox.y,
        width: startBox.width,
        height: startBox.height,
        opacity: startStyle.opacity,
        transform: startStyle.transform,
      };

      animation.currentTime = phaseTime(0.58);
      const actionBox = target.getBoundingClientRect();
      const actionStyle = getComputedStyle(target);
      const action = {
        x: actionBox.x,
        y: actionBox.y,
        width: actionBox.width,
        height: actionBox.height,
        opacity: actionStyle.opacity,
        transform: actionStyle.transform,
      };

      return {
        label: card.textContent.trim(),
        animated: animation.animationName !== 'none',
        changesPixels: JSON.stringify(start) !== JSON.stringify(action),
        actionSize: Math.max(action.width, action.height),
        impact: Math.max(
          Math.abs(action.x - start.x),
          Math.abs(action.y - start.y),
          Math.abs(action.width - start.width),
          Math.abs(action.height - start.height),
          Math.abs(Number(action.opacity) - Number(start.opacity)) * 16,
        ),
        start,
        action,
      };
    }),
  );

  for (const metric of metrics) {
    expect(metric.animated, `${metric.label} has no running illustration animation`).toBe(true);
    expect(metric.changesPixels, `${metric.label} animation does not change its rendered geometry or opacity`).toBe(true);
    expect(metric.actionSize, `${metric.label} moving detail is too small to read`).toBeGreaterThanOrEqual(14);
    expect(metric.impact, `${metric.label} motion is too subtle at normal card size`).toBeGreaterThanOrEqual(5);
  }
});
