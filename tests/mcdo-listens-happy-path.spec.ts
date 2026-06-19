import { test, expect, Page } from '@playwright/test';

const URL = 'https://www.mcdolistens.com/surveygma';

// ─────────────────────────────────────────────────────────────
// 500 combinations
// Survey code  : 4 digits starting with 0  → "0000" … "0499"
// Order number : 5 digits starting with 00 → "00000" … "00499"
// ─────────────────────────────────────────────────────────────
function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}

const SURVEY_CODES: string[]  = Array.from({ length: 500 }, (_, i) => pad(i, 4));
const ORDER_NUMBERS: string[] = Array.from({ length: 500 }, (_, i) => pad(i, 5));

// ─────────────────────────────────────────────────────────────
// Randomisation helpers
// ─────────────────────────────────────────────────────────────

/**
 * Pick a random NPS score between 8 and 10 (inclusive, equal weight).
 * Returns the 0-based index for li.num-option.scale-btn:
 *   score 8  → index 7
 *   score 9  → index 8
 *   score 10 → index 9
 */
function randomNpsIndex(): number {
  const score = 8 + Math.floor(Math.random() * 3); // 8, 9, or 10
  return score - 1; // convert to 0-based index
}

/**
 * Pick an emoji rating class with weighted probability:
 *   ~92.5% → "mratingslide_4"  (Extremely Satisfied)
 *   ~7.5%  → "mratingslide_3"  (Satisfied)
 *   Tweak SATISFIED_RATE (0.05–0.10) to adjust the split.
 */
const SATISFIED_RATE = 0.075; // 7.5% Satisfied, 92.5% Extremely Satisfied

function randomRatingClass(): 'mratingslide_4' | 'mratingslide_3' {
  return Math.random() < SATISFIED_RATE ? 'mratingslide_3' : 'mratingslide_4';
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

async function setNativeValue(page: Page, selector: string, value: string) {
  await page.evaluate(
    ([sel, val]) => {
      const el = document.querySelector(sel) as HTMLInputElement;
      if (!el) return;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )!.set!;
      setter.call(el, val);
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    [selector, value] as [string, string]
  );
}

async function waitForSpinner(page: Page, timeout = 12_000) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.pageloader2') as HTMLElement | null;
      return !el || el.style.display === 'none' || !el.offsetParent;
    },
    { timeout }
  );
}

async function isInvalidCode(page: Page): Promise<boolean> {
  return page
    .locator('small.help-block:has-text("Invalid survey code")')
    .isVisible();
}

// ─────────────────────────────────────────────────────────────
// Core survey runner
// Returns 'success' | 'invalid_code' | 'error'
// ─────────────────────────────────────────────────────────────
async function runSurvey(
  page: Page,
  surveyCode: string,
  orderNo: string,
  visitDate: string,
  visitTime: string
): Promise<'success' | 'invalid_code' | 'error'> {

  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  // ── Step 0: Welcome ─────────────────────────────────────────
  await expect(page.getByRole('heading', { name: 'WELCOME!' })).toBeVisible();
  await page.locator('#tcagreed').click();
  await expect(page.locator('#tcagreed')).toBeChecked();
  await page.locator('button:has-text("Let\'s Begin")').click();

  // ── Steps 1–2: Receipt intro slides ─────────────────────────
  await expect(
    page.getByText(/Your purchase has to be within the last 3 days/)
  ).toBeVisible();
  await page.locator('a:has-text("Next"), button:has-text("Next")').first().click();
  await page.locator('a:has-text("Next"), button:has-text("Next")').first().click();

  // ── Step 3: Survey Code ──────────────────────────────────────
  await expect(page.locator('#txtrestaurantnumber')).toBeVisible();
  await page.locator('#txtrestaurantnumber').fill(surveyCode);
  await page.locator('a.mnextbtn').click();
  await waitForSpinner(page);

  if (await isInvalidCode(page)) {
    return 'invalid_code';
  }

  // ── Step 4: Order Number ─────────────────────────────────────
  await expect(page.locator('#txtordernumber')).toBeVisible({ timeout: 8_000 });
  await page.locator('#txtordernumber').fill(orderNo);
  await page.locator('a.mnextbtn').click();
  await waitForSpinner(page);

  // ── Step 5: Date + Time ──────────────────────────────────────
  await expect(page.locator('#txtdateofvisit')).toBeVisible({ timeout: 8_000 });
  await setNativeValue(page, '#txtdateofvisit', visitDate);
  await setNativeValue(page, '#txttime', visitTime);
  await page.locator('a.mnextbtn').click();

  // ── Step 6: Order Type → Dine-in ────────────────────────────
  await expect(page.locator('text=Your order was:')).toBeVisible({ timeout: 8_000 });
  await page.locator('#rd1').click();
  await page.locator('a.mnextbtn').click();
  await waitForSpinner(page);

  // ── Survey questions (dynamic) ──────────────────────────────
  const npsIndex    = randomNpsIndex();
  const npsScore    = npsIndex + 1;
  let   ratingClass = randomRatingClass();

  const terminalTexts = [
    'Your feedback matters to us!',
    'Thank You!',
    'SORRY!',
  ];

  for (let step = 0; step < 40; step++) {

    // ── Terminal state check ───────────────────────────────────
    for (const txt of terminalTexts) {
      if (await page.locator(`text=${txt}`).isVisible()) {
        return txt === 'SORRY!' ? 'error' : 'success';
      }
    }

    // ── 1. Radio buttons ──────────────────────────────────────
    const visibleRadio = page.locator('input[type="radio"]:visible').first();
    if (await visibleRadio.isVisible()) {
      await visibleRadio.click();
      await page.locator('a.mnextbtn').click();
      await waitForSpinner(page);
      continue;
    }

    // ── 2. 5-point emoji rating ────────────────────────────────
    ratingClass = randomRatingClass();
    const ratingOpt = page.locator(`li.${ratingClass}`).first();
    if (await ratingOpt.isVisible()) {
      await ratingOpt.click();
      await page.locator('a.mnextbtn').click();
      continue;
    }

    // ── 3. Thumbs up / thumbs down → always thumbs up ─────────
    const thumbsUp = page.locator('div.like-btn').first();
    if (await thumbsUp.isVisible()) {
      await thumbsUp.click();
      await page.locator('a.mnextbtn').click();
      continue;
    }

    // ── 4. NPS 1–10 → random score 8, 9, or 10 ────────────────
    const npsItem = page.locator('li.num-option.scale-btn').nth(npsIndex);
    if (await npsItem.isVisible()) {
      await npsItem.click();
      console.log(`NPS score chosen: ${npsScore}`);
      await page.locator('a.mnextbtn').click();
      continue;
    }

    // ── 5. Open text comment ───────────────────────────────────
    const textarea = page.locator('textarea[placeholder="Type here..."]');
    if (await textarea.isVisible()) {
      await textarea.fill('Excellent visit! Everything was perfect.');
      await page.locator('a.mnextbtn').click();
      continue;
    }

    // ── 6. Mailing list → SKIP ─────────────────────────────────
    const emailInput = page.locator('input[placeholder="Enter Email"]');
    if (await emailInput.isVisible()) {
      await page.locator('a:has-text("SKIP"), text=SKIP').click();
      continue;
    }

    // ── 7. Demographics → SKIP ────────────────────────────────
    const ageInput = page.locator('input[placeholder="Enter your age"]');
    if (await ageInput.isVisible()) {
      await page.locator('a:has-text("SKIP"), text=SKIP').click();
      continue;
    }

    // ── Fallback ───────────────────────────────────────────────
    const nextEl = page.locator('a.mnextbtn');
    if (await nextEl.isVisible()) {
      await nextEl.click();
    }
    await page.waitForTimeout(600);
  }

  return 'error';
}

// ─────────────────────────────────────────────────────────────
// THE TEST — 500 combinations, auto-recalibrate on invalid code
// ─────────────────────────────────────────────────────────────
test('McDo Listens – full survey happy path (500 combinations)', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000); // 30 min ceiling

  const visitDate = yesterday();
  const visitTime = '12:00';

  let attempts     = 0;
  let successes    = 0;
  let invalidCodes = 0;
  let errors       = 0;
  const successLog: string[] = [];

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`McDo Listens Happy Path — ${SURVEY_CODES.length} combinations`);
  console.log(`Visit date : ${visitDate}  |  Visit time : ${visitTime}`);
  console.log(`NPS        : random from 8, 9, 10`);
  console.log(`Emoji      : ~${Math.round((1 - SATISFIED_RATE) * 100)}% Extremely Satisfied  /  ~${Math.round(SATISFIED_RATE * 100)}% Satisfied`);
  console.log(`${'─'.repeat(60)}\n`);

  for (let i = 0; i < SURVEY_CODES.length; i++) {
    const surveyCode = SURVEY_CODES[i];
    const orderNo    = ORDER_NUMBERS[i];
    attempts++;

    process.stdout.write(
      `  [${String(attempts).padStart(3)}/${SURVEY_CODES.length}]  code=${surveyCode}  order=${orderNo}  →  `
    );

    const result = await runSurvey(page, surveyCode, orderNo, visitDate, visitTime);

    if (result === 'success') {
      successes++;
      successLog.push(`code=${surveyCode} order=${orderNo}`);
      console.log('✅ SUCCESS');
    } else if (result === 'invalid_code') {
      invalidCodes++;
      console.log('❌ invalid code — recalibrating…');
    } else {
      errors++;
      console.log('⚠️  error state');
    }
  }

  // ── Summary ───────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  console.log(` RESULTS`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  Total attempts  : ${attempts}`);
  console.log(`  ✅ Successes    : ${successes}`);
  console.log(`  ❌ Invalid codes: ${invalidCodes}`);
  console.log(`  ⚠️  Errors       : ${errors}`);
  if (successLog.length) {
    console.log(`\n  Successful combos:`);
    successLog.forEach(s => console.log(`    ${s}`));
  }
  console.log(`${'─'.repeat(60)}\n`);

  expect(attempts).toBe(SURVEY_CODES.length);
});

// ─────────────────────────────────────────────────────────────
// Single-shot test when you already have a valid code
// MCDO_SURVEY_CODE=0123 MCDO_ORDER_NO=00456 npx playwright test --grep "known valid code"
// ─────────────────────────────────────────────────────────────
test('McDo Listens – full survey with known valid code', async ({ page }) => {
  test.skip(!process.env.MCDO_SURVEY_CODE, 'Set MCDO_SURVEY_CODE env var to run');
  test.setTimeout(5 * 60 * 1000);

  const surveyCode = process.env.MCDO_SURVEY_CODE!;
  const orderNo    = process.env.MCDO_ORDER_NO  ?? '00001';
  const visitDate  = process.env.MCDO_VISIT_DATE ?? yesterday();
  const visitTime  = process.env.MCDO_VISIT_TIME ?? '12:00';

  console.log(`\n▶ Single-shot  code=${surveyCode}  order=${orderNo}  date=${visitDate}\n`);

  const result = await runSurvey(page, surveyCode, orderNo, visitDate, visitTime);

  console.log(`  Result: ${result}`);
  expect(result).toBe('success');

  await expect(page.locator('text=Thank you for participating!')).toBeVisible();
  await expect(page.locator('text=Your feedback matters to us!')).toBeVisible();
  await expect(page.locator('text=We look forward to receiving')).toBeVisible();
});

