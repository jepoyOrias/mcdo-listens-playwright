# McDo Listens – Playwright Test Suite

Automated Playwright test suite for the [McDo Listens](https://www.mcdolistens.com/surveygma) customer satisfaction survey.

Runs on **desktop** (Chromium, Firefox, WebKit) and **mobile** (Pixel 5, iPhone 13 emulation).

---

## Features

- 500 survey code + order number combinations tested automatically
- Random NPS scores (8, 9, or 10) per run
- Weighted emoji ratings (~92.5% Extremely Satisfied / ~7.5% Satisfied)
- Single-shot mode for a known valid code
- Works on all major browsers and mobile emulation

---

## Quick Start (Local)

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
npm install
npx playwright install
```

### Run All Tests (Desktop + Mobile)

```bash
npm test
# or
npx playwright test
```

### Desktop Only

```bash
npm run test:desktop
# or
npx playwright test --project=chromium --project=firefox --project=webkit
```

### Mobile Only

```bash
npm run test:mobile
# or
npx playwright test --project=mobile-chrome --project=mobile-safari
```

### Single-Shot (Known Valid Code)

```bash
MCDO_SURVEY_CODE=0123 MCDO_ORDER_NO=00456 npx playwright test --grep "known valid code"
```

Optional env vars:

| Variable | Default | Description |
|---|---|---|
| `MCDO_SURVEY_CODE` | _(required)_ | 4-digit survey code |
| `MCDO_ORDER_NO` | `00001` | 5-digit order number |
| `MCDO_VISIT_DATE` | yesterday | ISO date (YYYY-MM-DD) |
| `MCDO_VISIT_TIME` | `12:00` | Visit time (HH:MM) |

---

## Project Structure

```
mcdo-listens-playwright/
├── tests/
│   └── mcdo-listens-happy-path.spec.ts   # Main test file
├── playwright.config.ts                  # Browser projects (desktop + mobile)
├── tsconfig.json
├── package.json
└── README.md
```

---

## View HTML Report

After running tests:

```bash
npm run report
```

---

## Notes

- The 500-combination test has a 30-minute timeout ceiling
- Invalid survey codes are logged and skipped (the loop continues)
- The suite uses `workers: 1` (sequential) since each run goes through a full browser session
