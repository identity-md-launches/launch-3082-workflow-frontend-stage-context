# Hamster Nap 3D frontend

One English page for the deployed NAP game on Sepolia: trade ETH/NAP, watch the ETH prize pool and certified rounds, settle naps, withdraw owed ETH, redeem pot claims and trigger the failsafe. The fixed prize bar includes the latest qualifying buyer, buy age and zero-work count. Core selection, finalization and core events are read from the new hook. This is an unofficial community game; test tokens have no value.

## Install, develop and export

Node 22.12+ is required. All frontend packages and configuration stay in this directory.

```sh
npm ci --prefix web --cache web/.cache/npm
npm run dev --prefix web
npm run typecheck --prefix web
npm test --prefix web
npm run build --prefix web
npm run verify --prefix web
npm run preview --prefix web
```

The build uses Vite `base: './'`, writes repository-root `dist/`, and then generates `dist/imd-deployment.json` from the final bytes. Host the entire export as static files, including ABI JSON and dynamically imported JS chunks. No backend or rewrite rule is required; navigation uses hashes. After changing any exported file, rebuild the manifest and run verification. The submitted export is already built; publication does not require rebuilding.

## Deployment and ABI source of truth

The app fetches `./imd-deployment.json` and the exact ABI paths declared there. `src/config.ts` creates the public client, chain and wallet connectors from that runtime file. There is no separate runtime address, chain ID or RPC map. The core address comes from the hook's `core()` getter, not a frontend constant. Its `coreFinalized()` and `owner()` getters drive the disclosure line.

`deployment.handoff.json` and `network.handoff.json` are unchanged copies of the supplied public build inputs. They are not imported into the browser bundle. The build extracts raw ABI arrays from `docs/abi/<Contract>.json` at deployed commit `6499353948767b08860e5d7a51818a9cbb59f6ae` using `git show`, verifies each attested canonical Keccak, and exports it. Source archives without that Git object use the committed, verified `public/abi/` copies. The SqueekCore read ABI is also taken from that commit. Contracts and root build configuration are preserved.

The handoff contains no top-level `poolKey`. The exporter derives its native ETH/NAP key from the attested paired currency, token, fee, spacing and hook. Read-only live verification confirmed the resulting pool ID and token/PoolManager binding. A handoff with a `poolKey` is copied exactly instead. The supplied `network` and `walletAddChain` objects are copied unchanged. Protocol signatures live in `src/protocol.ts`; all protocol addresses come from `network.uniswapV4` at runtime.

The manifest contains the exact contract set, launch ID, chain, deployed source commit and attestation hash. It inventories every other exported file, including HTML and ABIs, with lowercase SHA-256; it excludes itself. `npm run verify` checks safe paths, complete inventory, canonical ABI hashes, exact network/contract binding and size limits. While pinned `.imd/reads/` inputs exist, it also compares the preserved handoff copies against them.

Runtime transactions require verified chain/code/pool binding and fresh game reads. ABI hash checks detect a mismatched exported interface. They do not independently authenticate the supplied attestation or audit deployed bytecode.

## Wallet and transaction flows

One connect sheet lists named EIP-6963 providers, then Coinbase Wallet. On a phone without injection, it offers MetaMask, Coinbase, Rabby and Phantom browser links and Coinbase Smart Wallet. No relay, project ID, application signer or private RPC credential is used. An unknown-chain switch (4902) triggers the exact `wallet_addEthereumChain` parameters and a second switch. Wrong-network signing stays gated.

Native ETH buys need no approval. Sells show separate exact-amount NAP-to-Permit2 and Permit2-to-router approval steps, only when needed, and wait for their receipts and allowance refresh. Quotes use the configured quoter through `simulateContract`. The reviewed minimum is frozen; execute refreshes the quote and allowances, rejects moved/expired reviews, simulates the router call, and rechecks wallet account/chain before signing. Wire encoding follows V4_SWAP `0x10` and actions `0x060c0f`, with the runtime pool key, selected slippage, five-minute deadline and native value only for ETH input. The optional extended tuple follows the network flag.

Each action has a pending lock, inline errors, confirmation status and transaction explorer link. Claim calls `settleNaps(8)`; the hook selects the historical winner. Credits exposes `withdrawOwed()`, `redeemClaims()` and `failsafe()` with their live prerequisites. The approved game page exposes no `setCore` or `finalizeCore` write controls; core administration is observational here. The page discloses that the owner may change the core and delay the failsafe until finalization, and that finalizing the selection does not freeze the external proxy.

The hook records `tx.origin`, so a smart wallet can record its relayer as buyer. This risk is stated beside trading. Amounts use token decimals; test tokens have no monetary value and there is no invented USD price.

## Observability

- SqueekChain status: fetch every 10 seconds, with schema, timestamp and RPM checks; running, resting, stale and offline are distinct. The console link opens the real SqueekChain console. API activity is separate from certified progress.
- Hook/core/balances: refresh every 12 seconds; stale or failed reads are labeled and signing is gated. Public RPCs intentionally fail over; correct-chain wallet-provider fallback is available for game reads.
- Quotes: refresh every 15 seconds; allowances every 10 seconds; deployment verification every five minutes.
- Winners and core events: a bounded 10,000-block window in 2,000-block pages, every 60 seconds. Load older events moves the shared winner/core window backward. Failures are shown, never interpreted as empty history. Events sort by block and log index.
- Buy age: scan recorded cumulative fee differences backward in pages, excluding later dust by the same buyer, cached by buy count.

The three-round meter uses only settled core rounds; it may show 3/3 before the game starts or after a continuous run has paid. Claim eligibility comes from hook simulation rather than the meter.

## Validation

```sh
npm run typecheck --prefix web
npm test --prefix web
npm run build --prefix web
npm run verify --prefix web
# Install test browsers into disposable scratch, not the submission.
PLAYWRIGHT_BROWSERS_PATH="$PWD/test/scratch/browsers" web/node_modules/.bin/playwright install chromium --only-shell
PLAYWRIGHT_BROWSERS_PATH="$PWD/test/scratch/browsers" npm run test:browser --prefix web
# Read-only public chain verification and quote simulation; never signs.
node --import ./web/node_modules/tsx/dist/loader.mjs web/scripts/check-live.ts
```

On hosts Playwright does not recognize, `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64` can select its compatible Linux browser build. An installed browser may instead be selected for the browser suite using `PLAYWRIGHT_EXECUTABLE_PATH`. The suite owns and closes its static `/preview/` server and browser within one foreground command. Mock wallets and RPCs prevent any real broadcasts.

The pinned design probe also ran on the production export. See [validation](../docs/frontend/VALIDATION.md), [implemented design](../docs/DESIGN.md), browser results, live observations and selected screenshots under `docs/frontend/`. The design document is under `docs/` because the explicit path budget excludes repository-root `DESIGN.md`.

Funded transactions, real extensions, Coinbase passkeys, physical mobile handoffs and publication checks remain untested. The worker does not deploy contracts, publish a site or pin IPFS. The relative social image is bundled; absolute host-specific social URLs are a publisher concern once a host is known.

## Assets and attribution

The sharp N monogram and share graphic are original frontend assets. `scripts/make-share.mjs` regenerates the 1200 × 630 share PNG with Playwright. Typography uses system Arial/Helvetica and monospace stacks; no remote font is loaded. Wallet marks are retained from RainbowKit 2.2.11 (MIT), with their notice under `docs/frontend/`.

Design/review applies the pinned Better Interface guide by Jakub Krehel (MIT, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`) and the Impeccable documentation method by Paul Bakaus (Apache-2.0, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`). The pinned Austin Griffith ethskills frontend UX/testing guidance is MIT. Notices are retained under `docs/frontend/`.
