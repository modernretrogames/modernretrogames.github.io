#!/usr/bin/env node
import { chromium } from 'playwright';

const url = 'http://localhost:8080/aliens.html';
const consoleErrors = [];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// Capture console messages
page.on('console', (msg) => {
  const type = msg.type();
  const text = msg.text();
  if (type === 'error') {
    consoleErrors.push(text);
  }
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });

// Take screenshot
await page.screenshot({ path: 'aliens-page-screenshot.png' });

// Check for elements (menu screen only - first visible title)
const title = await page.locator('#menu-screen .aliens-title').first().textContent();
const startBtn = await page.locator('#start-btn');
const startBtnVisible = await startBtn.isVisible();
const startBtnText = await startBtn.textContent();

console.log('=== VERIFICATION RESULTS ===');
console.log('1. SPACE INVADERS title:', title?.trim() || 'NOT FOUND');
console.log('2. CLICK TO START button visible:', startBtnVisible);
console.log('3. Button text:', startBtnText?.trim() || 'N/A');
console.log('4. JavaScript console errors:', consoleErrors.length);
if (consoleErrors.length > 0) {
  console.log('   Errors:', consoleErrors);
}

await browser.close();
