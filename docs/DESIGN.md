# Hamster Nap 3D: implemented design

## Overview

A dense, number-first NAP game terminal for Sepolia traders. Near-black surfaces, sharp geometry, monospace figures and one acid accent follow the approved crypto degen direction. Product identity and connection sit above the trading controls without a marketing hero. The ETH pot is the largest figure and stays fixed at the top with its buyer, buy age and certified zero-work count.

The source of truth is `web/src/styles.css`; composition lives in `App.tsx`, `Trade.tsx` and `Wallet.tsx`. The system is deliberately dark-only. This document is delivered under `docs/` because the assignment's overriding write scope excludes a root `DESIGN.md`.

## Colors

All semantic tokens are declared in `web/src/styles.css:1`, using sRGB hex. There is no unused theme or extra accent ramp.

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#090b09` | Canvas and amount fields |
| `--surface` | `#111410` | Pot bar, trade/live panels and wallet sheet |
| `--raised` | `#1b2018` | Hover surfaces and disabled primary fill |
| `--text` | `#f0f2e9` | Body text, headings and links |
| `--muted` | `#a4ad9e` | Secondary labels and pending data |
| `--line` | `#343c2e` | Structural dividers and field outlines |
| `--accent` | `#d7ff3f` | Pot figure, primary fill, active direction and certified segments |
| `--accent-hover` | `#e4ff80` | Primary hover fill |
| `--accent-ink` | `#121607` | Text on accent fill |
| `--error` | `#ffa995` | Error and offline/stale text |
| `--focus` | `#f0f2e9` | Two-pixel keyboard perimeter |

The accent marks priority and selected data as requested, while action affordances also use borders, native controls and underlines. Status labels and meter text provide meaning without color. The dialog backdrop is black at 80% opacity. There are no gradients or decorative shadows. Measured solid-background contrast pairs are recorded in `frontend/browser-results.json`; the pinned probe checks measured text against 4.5:1, or 3:1 for large text.

## Typography

Prose and controls use `Arial, Helvetica, sans-serif`, with weights 400 and 700. Numbers and address links use `--font-mono`: `SFMono-Regular, Consolas, Liberation Mono, monospace`, with tabular numerals. Fonts are system-provided; no bundled rounded font or font request remains. Actual platform fallback can vary.

The six-size scale is `--text-small` 12px, `--text-body` 14px, `--text-label` 16px, `--text-title` 20px, `--text-heading` 28px and `--text-pot` 48px at a 16px root. Body line height is 1.5; headings and the pot use 1.2. The product heading is 28px on desktop and 20px at 760px and below. Pot figures remain 48px at both widths, with 20px ETH units. Amount fields and RPM use 28px. No tracked uppercase kicker labels are used.

Headings balance wrapping; amounts, balances and long addresses can break instead of escaping their columns. Full checksummed addresses are available through explorer links, accessible names/tooltips and copy controls. Rules have a maximum 75-character measure. Native inputs stay above the iOS zoom threshold.

## Layout

`.pot-bar` is fixed at top, full width, z-index 20. Its inner content and `.page-shell` share a 1160px maximum outer width. The bar uses three desktop columns and 24px side padding. At 760px and below the pot spans the first row; buyer and progress share the next row with 16px side padding. `App.tsx` measures the bar using `ResizeObserver`, stores `--pot-bar-height` on the root and reserves that height plus 20px (desktop) or 16px (mobile) before the page header. Root scroll padding offsets anchor and focus destinations.

Spacing follows 4, 8, 12, 16, 20, 24 and 32px groups. The desktop arena is a two-column grid with a 24px gutter, a flexible live-state panel and a 420px trade column. At 760px and below it stacks with trading first. Header controls, data rows, address wrappers and navigation can wrap. Claim/utility rows stack their controls on mobile; contract links become one column. Sections use 24px padding after a divider, separated by 32px on desktop and 24px on mobile.

Rendered checks cover 320, 390, 768 and 1440 CSS pixels, long balances/full addresses, 200% text enlargement and multiple scroll positions. The product, wallet and main trade action fit the first 390 × 844 screen. Browser measurements and screenshots are retained under `frontend/`. Text enlargement is distinct from native browser zoom, which was not tested.

## Elevation & Depth

The interface is flat. Tonal surfaces group live state and trading; one-pixel borders divide rows, selected tabs and fields. No border-plus-shadow card treatment is used. The accent two-pixel lower edge separates the fixed pot bar. The skip link uses z-index 100; the native modal occupies the browser top layer and its backdrop blocks background interaction.

## Shapes

Buttons, inputs, panels, tabs, favicon and sheet have square corners (`border-radius: 0` on controls; no rounded container rules). Six-pixel squares identify wallet/feed state. Three equal rectangular segments display zero-work progress. Wallet vendors' original icon shapes/colors are retained. There is no cartoon, sleeping illustration or bedroom decoration.

## Components

- `App.tsx` pot-bar pattern: pot, latest qualifying buyer, buy age and settled progress. Loading is an ellipsis/unknown count; failed or old reads explicitly show stale status. Height is measured whenever content or viewport changes.
- `App.tsx` `AddressLink`: short checksummed link, full title/accessible name and copy action with confirmation. It wraps under long-value stress.
- `Trade.tsx` `Trade`: native direction buttons with `aria-pressed`, labeled amount input, slippage select and a single filled primary action. States progress through connect, switch, exact approvals, review, confirmation and receipt. Errors remain inline; a smart-wallet origin warning sits with the control.
- `Trade.tsx` `TxFeedback`: status region, alert error and explorer receipt link. Each transaction hook has its own state and synchronous duplicate lock.
- `App.tsx` `Claims`: settle control plus native disclosure for withdrawal, pot-claim redemption and failsafe. Live prerequisites gate actions. The contract chooses payout recipients.
- Core section pattern in `App.tsx`: active proxy, finalization, immutable owner and a native disclosure for `CoreChanged` / `CoreFinalized` events using the shared paginated history window. This game page provides no administrative write form.
- `Wallet.tsx` `Wallet`: one connect/switch/address button and named native `<dialog>`. EIP-6963 rows include provider marks; phones offer wallet-browser links plus Coinbase Smart Wallet. Rows are at least 52px; Escape/backdrop/close dismiss and focus returns to the trigger. At 639px and below the dialog docks to the bottom.
- Shared CSS patterns: `.primary`, `.secondary`, `.text-button`, `.section-head`, `.numeric`, `.small`, `.muted`, `.error`, `.address-wrap`, `.status-pill`. Native disabled controls, inline status/error text, hover and 0.96 press scale distinguish interaction states. `:focus-visible` has a two-pixel explicit outline with a three-pixel offset.

Motion consists of named 150ms background/color transitions and press feedback. Reduced motion disables transitions, animation and smooth scrolling; there is no entrance sequence, ticker or endless animation. Forced-colors styles preserve system focus colors.

## Do's and Don'ts

Start another game section inside `.page-shell`, reuse the shared spacing/dividers and put the relevant control beside its state. Use `.numeric` for amounts and IDs, `.small.muted` for supporting data and `.error` only with explanatory text. Reserve a single acid-filled primary action for the trading flow; other actions use neutral controls.

Keep the prize bar's measured space and the mobile trade-first order. Let values wrap and disclosures grow. Keep contract facts in runtime reads and use the shared deployment configuration. Preserve the blunt, factual vocabulary and test-token context. Rounded cards, rounded type, cartoon art, bedtime copy, invented price charts, profit promises and additional marketing blocks conflict with the approved direction.
