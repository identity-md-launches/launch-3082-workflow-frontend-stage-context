# Frontend validation: Hamster Nap 3D

## Scope and decisions

Updated the existing Vite/React/TypeScript game page for the newly deployed `HamsterNap3D` hook and `NapToken`, preserving contract source, tests and root configuration. Delivered source/configuration/lockfile under `web/`, a complete static export under `dist/`, and evidence/design documentation under `docs/`. Only those paths changed.

The approved visual direction is near-black, sharp, dense and number-first, with monospace figures and one acid accent. The pot, buyer, buy age and zero-work count remain at the top. The page adds live core/finalization/owner reads and core event history. Administrative writes are intentionally absent because the approved website limits connected visitors to game/trade actions; it requests a core disclosure line, not a management console.

The explicit overriding write budget does not allow repository-root `DESIGN.md`. The complete implemented design is therefore [docs/DESIGN.md](../DESIGN.md), which is the required document within the permitted documentation scope. No root design file was created.

The supplied handoff has no top-level pool key. The exporter derives it from the attested ETH pair, token, fee, spacing and new hook. Live read-only verification confirmed its pool ID/token/PoolManager binding. A supplied pool key would instead be copied exactly. Network and wallet-add-chain objects are copied unchanged.

## Executed checks

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript | Pass, exit 0 | `typecheck.txt` |
| Production build | Pass, exit 0 | `build.txt` |
| Unit tests | 13 pass, 0 fail | `unit-tests.txt` |
| Production browser interactions | 28 checks pass | `browser-results.json` |
| Axe scans | 0 violations in disconnected and connected/expanded states | `browser-results.json` |
| Pinned design probe | 16/16 checks pass | `taste-results.json` |
| Deployment/export verification | Pass; 17 assets, 1,472,900 bytes excluding manifest | `export-verification.txt` |
| Read-only chain/code/pool/core check and quote | Pass | `live-read-evidence.json` |
| Live activity endpoint | HTTP 200, schema 1, online, RPM 0 | `status-feed-evidence.json` |
| Whitespace/path/size audit | Pass | `submission-budget.json`; `git diff --check` |

Commands ran from the repository root:

```sh
npm ci --prefix web --cache web/.cache/npm
npm run typecheck --prefix web
npm test --prefix web
npm run build --prefix web
npm run verify --prefix web
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 PLAYWRIGHT_BROWSERS_PATH="$PWD/test/scratch/browsers" npm run test:browser --prefix web
IMD_PLAYWRIGHT="$PWD/web/node_modules/playwright/index.mjs" PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 PLAYWRIGHT_BROWSERS_PATH="$PWD/test/scratch/browsers" node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
node --import ./web/node_modules/tsx/dist/loader.mjs web/scripts/check-live.ts
git diff --check
```

The browser suite serves the actual export at `/preview/`, manages its own server and Chromium within one foreground command, and closes both. Public RPC, activity and wallet responses are intercepted for interactions; unexpected external requests are blocked. Mock transaction receipts exercise frontend state without spending funds. The pinned probe ran separately against the export without mocked application state; its external requests were unavailable in that browser run, so those screenshots show loading/offline recovery, not successful live chain reads.

The supplied browser MCP could not start because its Chrome distribution was absent. Actual rendering and interaction checks used locally installed Playwright Chromium instead. The host required Playwright's compatible Ubuntu 24.04 browser selection; browser binaries and download artifacts stayed in disposable `test/scratch/`. The initial launcher failure is not counted as a successful browser check. No Docker image, vendored registry or dependency archive is required or submitted.

The build reports third-party Rollup annotation warnings; it completes successfully. No local resource failures or browser script exceptions occurred in the interaction suite. Package-manager environment diagnostics were omitted from retained logs; build/test output and results remain.

## Interaction coverage

The 28 browser checks include product/state/action visibility, a neutral disconnected balance state, winner payout links, new core getters, core changes and finalization, EIP-6963 discovery, Tab/Enter connection, Escape and focus return, exact 4902 add-chain fallback, buy quote/review/router simulation, wallet rejection/retry, native buy value, wrong-chain gating, both exact-amount approval steps, sell value/receipt feedback, bounded nap settlement, owed withdrawal, claim redemption and failsafe simulation/submission, corruption of an ABI, missing code, quote errors, unreadable core with sell preserved, missing desktop wallets, four mobile wallet-browser links and Coinbase Smart Wallet, and running/resting/stale/offline API behavior.

Viewport checks cover 320, 390, 768 and 1440 CSS pixels. All connected layouts have no horizontal overflow. The pot stays at `y=0` at 25%, 50% and 100% scroll at every tested width, and its number stays within the bar. Its measured height is reserved before the initial header. Long pot/balance values, a full checksummed address and 200% text enlargement also reflow without horizontal scroll. These are browser checks of specific states, not an assertion about all possible content or native zoom.

At 390 × 844, the measured product bottom is **234.59px**, wallet bottom **310.59px**, main trade-action bottom **689.59px**, and pot-bar bottom **192.59px**; content begins at **208.59px**. `mobile-measurements.json` retains the rectangles and scroll results. The final disconnected mobile and connected desktop screenshots were inspected, as were fixed-pot bottom-scroll and keyboard-focus states. Screenshots depict explicit mock state, not real winnings.

Selected rendered artifacts:

- `mobile-390.png`: disconnected product, live-state mock and trade control.
- `desktop-1440.png`: connected sell and expanded utility/core states.
- `keyboard-focus-390.png`: keyboard focus on connect.
- `wallet-sheet-390.png`: mobile wallet choices without injection.
- `pot-bottom-390.png` and `pot-bottom-1440.png`: fixed bar at the page bottom.

## Better Interface coverage

The pinned workflow and core principles from all six domains were read and applied during implementation, then reviewed together against the final export. The documentation method was applied to final source and measured browser evidence. License/provenance notices are retained alongside this file.

| Domain | Coverage | Inspected states and limitations |
| --- | --- | --- |
| Accessibility | Checked | Native controls, field label, named dialog, progress group, skip link, explicit focus ring, keyboard connection/dismissal/focus return, inline status/alerts and two axe scans. No screen-reader, physical-device or forced-colors session. Automated scans are not a claim of complete accessibility compliance. |
| Layout | Checked | Trade-first mobile order, shared edges, 320/390/768/1440 reflow, fixed pot and reserve, scroll positions, full address/large amounts and 200% text enlargement. Native browser zoom and RTL were not tested; English is the requested language. |
| Writing | Checked | Product name, blunt verb-led controls, no bedtime/cartoon/marketing language, test-token context, fee/claim consequences, owner powers and origin warning, persistent recovery text. No profit promise or invented USD value. |
| Typography | Checked | Two system font stacks, two weights, six-size token scale, largest pot number, tabular figures and wrapping. Actual system fallback varies; no non-Latin or cross-platform font session was performed. |
| Colors | Checked | Small semantic palette, redundant status labels, five computed solid contrast pairs and probe contrast checks. No unrequested light theme. Dialog-backdrop compositing and all possible future states are not covered by the five reported pairs. |
| UI details | Checked | Square surfaces, neutral secondary actions, one accent primary, local wallet marks, native dialog/disclosures, hover/focus/pressed/pending/disabled/error/success states and reduced motion. No endless animation; slow-motion animation-panel review was unnecessary and not performed. |

Computed contrast from `browser-results.json` / `render-evidence.json`: muted identity on canvas **8.51:1**, pot label on bar **16.42:1**, pot number on bar **16.14:1**, primary text on accent fill **15.97:1**, and muted trade note on panel **8.00:1**. These are measured pairs from the inspected state. The probe also passes its measured-text thresholds. Some dense secondary targets are below the comfortable 44px recommendation; the probe confirms the 24px size/spacing floor, while primary actions are 48px or taller and wallet rows are at least 52px.

## Findings and fixes

Locations refer to the final source containing the correction.

| Severity / source | Finding and impact | Correction and evidence |
| --- | --- | --- |
| High — `web/src/config.ts:118`, `web/src/reads.ts:140` | Prior deployment name/ABI and `CORE()` getter could not read the new hook. | Runtime contract binding uses `HamsterNap3D`; ABIs come from the pinned deployed commit; reads use `core()`, `coreFinalized()` and `owner()`. Live chain, ABI verification and browser checks pass. |
| High — `web/src/App.tsx:226`, `web/src/styles.css:139` | Old pot was inside scrolling content, violating permanent visibility. | Fixed bar plus observed-height reservation, wrapping and scroll padding. Mobile/desktop screenshots and tested scroll positions confirm position and reserved initial space. |
| Medium — `web/src/App.tsx:398` | New progress wrapper initially used `aria-label` on a generic div; axe reported `aria-prohibited-attr`. | Added `role="group"`; both final axe states have zero violations. |
| Medium — `web/src/App.tsx:647`, `web/src/reads.ts:253` | New core selection/finalization and historical switches were absent from the old page. | Read-only core section, owner-power disclosure, both event types, log-index ordering and shared history pagination. Mocked change/finalization tests and live getter reads pass. |
| Medium — `web/src/App.tsx:455` | Decorative running bars could suggest a measured time series the API did not supply. | Replaced with a factual feed/refresh label and actual API RPM, separate from certified progress. Running and resting browser states pass. |
| Low — `web/src/Trade.tsx:478` | Initial desktop first-screen prose was 93 words against the probe's 90-word budget. | Shortened the origin warning without removing its consequence. Final probe: 87 desktop / 38 mobile words; all 16 checks pass. |
| Functional — `web/scripts/verify-export.mjs:53` | Prior safe ABI-path regex rejected the digit in `HamsterNap3D`. | Permit alphanumeric Solidity identifiers while retaining a relative `abi/*.json` path shape and independent inventory/path/hash checks. Final export verification passes. |

No reproduced high/medium worker behavior remains unresolved. Root design-document placement and Git commit availability are the delivery limitations below.

## Live observations and limits

`live-read-evidence.json` records Sepolia chain ID, nonempty application/Uniswap code, pool binding, live game state and the active core's readable configuration. The observed core genesis is **1793735400**, round duration **600**, `coreFinalized=false`, and the pot was zero at that observation. A **0.001 ETH** quoter `eth_call` returned nonzero NAP output; exact units are in the evidence. This does not establish funded router execution or a successful payout. `status-feed-evidence.json` separately records a real HTTP 200 activity response with online hardware-origin measurement and RPM zero. None of these observations is seeded into the app as live state.

No real approval, swap, nap payout, withdrawal, claim redemption, failsafe, core switch or finalization was broadcast. Real browser extensions, Coinbase passkey creation, physical iOS/Android handoffs, hardware wallets and all-public-RPC-down wallet fallback were not exercised end to end. Contracts and their Foundry suite were preserved and not rerun by this frontend worker. Mock receipts establish frontend flow, not protocol economic correctness.

The final hostname is not assigned to this worker. `og:image` points to the actual bundled 1200 × 630 PNG using a relative path; a crawler's final absolute URL is a publication check. IPFS pinning, ENS naming and the control plane's immutable/named HTTP hash and RPC checks have not run and are not claimed as worker validation.

## Delivery state

Implementation, static export and worker validation are complete within the allowed scope, with the stated design-document location exception. Source, lockfile, verified ABI copies, runtime assets and the regenerated deployment manifest are retained together. Dependencies, caches and browser tooling are excluded from Git; export size is far below the response budget and the full changed-file byte budget is recorded separately.

A Git commit could not be created: `git add -- web dist docs` failed because `.git/index.lock` is on a read-only filesystem. No escalation or metadata bypass was attempted. The complete files remain available in the allowed paths for submission-bundle capture. This report is worker evidence, not independent verification or publication certification.
