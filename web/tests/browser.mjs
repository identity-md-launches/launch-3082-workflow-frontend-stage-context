import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  encodeFunctionResult,
  decodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toHex,
  zeroAddress,
  encodeEventTopics,
  encodeAbiParameters as enc,
} from "viem";
import { serve } from "../scripts/serve.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const dist = fileURLToPath(new URL("../../dist/", import.meta.url));
const d = JSON.parse(readFileSync(dist + "imd-deployment.json", "utf8"));
const abis = Object.fromEntries(
  d.contracts.map((c) => [
    c.name,
    JSON.parse(readFileSync(dist + c.abiPath, "utf8")),
  ]),
);
abis.Core = JSON.parse(readFileSync(dist + "abi/SqueekCore.json", "utf8"));
const { parseAbi } = await import("viem");
abis.Quoter = parseAbi([
  "function quoteExactInputSingle(((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 exactAmount,bytes hookData) params) returns(uint256 amountOut,uint256 gasEstimate)",
]);
abis.Router = parseAbi([
  "function execute(bytes commands,bytes[] inputs,uint256 deadline) payable",
]);
abis.Permit = parseAbi([
  "function allowance(address owner,address token,address spender) view returns(uint160 amount,uint48 expiration,uint48 nonce)",
  "function approve(address token,address spender,uint160 amount,uint48 expiration)",
]);
const a = d.contracts.find((c) => c.name === "NapToken").address;
const h = d.contracts.find((c) => c.name === "HamsterNap3D").address;
// Mock outside state uses the pinned implementation defaults, never a separate runtime map.
const source = readFileSync(root + "src/HamsterNap3D.sol", "utf8");
const core = source.match(
  /public core = ISqueekCore\((0x[a-fA-F0-9]{40})\)/,
)[1];
const evidence = {
  configuration: {
    streamId: "0x" + "01".repeat(32),
    genesisTimestamp: "1793735400",
    roundDuration: "600",
    maxWorkPerRound: "10000",
    maxRoundsPerBatch: 16,
    guardian: core,
    reporter: core,
    initialWorkPerThousandBlocks: 10000,
    targetBlocksPerActiveRound: "40",
    difficultySmoothingRounds: "30",
    blockUnitsPerBlock: "1000000000",
  },
};
const player = d.contracts[0].address; // Existing public address used only as a mock account; no key.
const hash = "0x" + "12".repeat(32);
const head = 12079500n;
const now = BigInt(Math.floor(Date.now() / 1000));
const block = {
  number: toHex(head),
  hash,
  parentHash: hash,
  timestamp: toHex(now),
  gasLimit: "0x1c9c380",
  gasUsed: "0x100",
  baseFeePerGas: "0x3b9aca00",
  transactions: [],
  difficulty: "0x0",
  totalDifficulty: "0x0",
  extraData: "0x",
  mixHash: hash,
  nonce: "0x0000000000000000",
  receiptsRoot: hash,
  sha3Uncles: hash,
  size: "0x100",
  stateRoot: hash,
  transactionsRoot: hash,
  uncles: [],
  miner: zeroAddress,
  logsBloom: "0x" + "00".repeat(256),
};
const receipt = {
  transactionHash: hash,
  transactionIndex: "0x0",
  blockHash: hash,
  blockNumber: toHex(head),
  from: player,
  to: h,
  cumulativeGasUsed: "0x100",
  gasUsed: "0x100",
  contractAddress: null,
  logs: [],
  logsBloom: "0x" + "00".repeat(256),
  status: "0x1",
  effectiveGasPrice: "0x1",
  type: "0x2",
};
let tokenAllowance = 0n,
  routerAllowance = 0n,
  quoteFails = false,
  coreFails = false,
  codeMissing = false,
  finalized = false,
  activity = "resting";
let failSafeOpen = false;
const calls = [];
const findings = [];
const accessibilityScans = [];
const localFailures = [];
const localNavigationAborts = [];
function getCall(data) {
  for (const [name, abi] of Object.entries(abis)) {
    try {
      return { name, abi, ...decodeFunctionData({ abi, data }) };
    } catch {}
  }
  throw Error("Unknown call " + data.slice(0, 10));
}
function rpc(method, params = []) {
  calls.push({ method, params });
  if (method === "eth_chainId") return toHex(d.chainId);
  if (method === "eth_getCode") return codeMissing ? "0x" : "0x60006000";
  if (method === "eth_blockNumber") return toHex(head);
  if (method === "eth_getBlockByNumber" || method === "eth_getBlockByHash")
    return block;
  if (method === "eth_getBalance") return toHex(10n ** 19n);
  if (method === "eth_gasPrice" || method === "eth_maxPriorityFeePerGas")
    return "0x3b9aca00";
  if (method === "eth_getTransactionCount") return "0x0";
  if (method === "eth_estimateGas") return "0x30000";
  if (method === "eth_getTransactionReceipt") return receipt;
  if (method === "eth_getLogs") {
    const filter = params[0];
    if (BigInt(filter.fromBlock) > head || BigInt(filter.toBlock) < head)
      return [];
    const common = {
      address: h,
      blockHash: hash,
      blockNumber: toHex(head),
      transactionHash: hash,
      transactionIndex: "0x0",
      removed: false,
    };
    return [
      {
        ...common,
        logIndex: "0x2",
        topics: encodeEventTopics({
          abi: abis.HamsterNap3D,
          eventName: "CoreChanged",
          args: { oldCore: player, newCore: core },
        }),
        data: "0x",
      },
      ...(finalized
        ? [
            {
              ...common,
              logIndex: "0x3",
              topics: encodeEventTopics({
                abi: abis.HamsterNap3D,
                eventName: "CoreFinalized",
                args: { core },
              }),
              data: "0x",
            },
          ]
        : []),
      {
        ...common,
        logIndex: "0x0",
        topics: encodeEventTopics({
          abi: abis.HamsterNap3D,
          eventName: "NapSettled",
          args: { napStart: 650n, winner: player },
        }),
        data: enc(parseAbiParameters("uint256"), [30000000000000000n]),
      },
      {
        ...common,
        logIndex: "0x1",
        topics: encodeEventTopics({
          abi: abis.HamsterNap3D,
          eventName: "Buy",
          args: { buyer: player },
        }),
        data: enc(parseAbiParameters("uint256,uint256,uint64,bool"), [
          2000000000000000n,
          40000000000000n,
          655n,
          true,
        ]),
      },
    ];
  }
  if (method === "eth_call") {
    const c = getCall(params[0].data);
    const fn = c.functionName;
    let result;
    if (c.name === "Core" && coreFails) throw Error("core unavailable");
    const values = {
      pot: 50000000000000000n,
      latestBuyer: player,
      scanRound: 650n,
      zeroRun: 0n,
      napsSettled: 2n,
      owed: 1000000000000000n,
      claimsHeld: 2000000000000000n,
      failsafeOpensAt: failSafeOpen ? now - 1n : now + 604800n,
      failsafeWinner: [player, 20000000000000000n],
      core,
      coreFinalized: finalized,
      owner: player,
      decimals: 18,
      MIN_QUALIFYING_BUY: 1000000000000000n,
      FEE_BPS: 200n,
      ROUND_DURATION: 600n,
      GENESIS_TIMESTAMP: 1793735400n,
      balanceOf: 10000000000000000000000n,
      poolBound: true,
      token: a,
      poolManager: d.network.uniswapV4.poolManager,
      mayBuy: true,
      settleNaps: 1n,
      buyCount: 1n,
    };
    if (fn === "buyAt")
      result = {
        round: 650n,
        time: now - 120n,
        cumulativeFees: 20000000000000n,
        latestBuyer: player,
      };
    else if (fn === "poolId")
      result = keccak256(
        encodeAbiParameters(
          parseAbiParameters(
            "(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)",
          ),
          [d.poolKey],
        ),
      );
    else if (fn === "state")
      result = {
        settledThroughRound: 660n,
        cumulativeWork: 57171n,
        cumulativeBlockUnits: 0n,
        blockHeight: 1n,
        blockProgress: 0n,
        workPerThousandBlocks: 10000,
        authorizationNonce: 0n,
        paused: false,
      };
    else if (fn === "configuration")
      result = {
        ...evidence.configuration,
        ...Object.fromEntries(
          [
            "genesisTimestamp",
            "roundDuration",
            "maxWorkPerRound",
            "targetBlocksPerActiveRound",
            "difficultySmoothingRounds",
            "blockUnitsPerBlock",
          ].map((k) => [k, BigInt(evidence.configuration[k])]),
        ),
      };
    else if (fn === "roundPage")
      result = {
        certifiedThroughRound: c.args[1],
        start: {
          cumulativeWork: 0n,
          cumulativeBlockUnits: 0n,
          workPerThousandBlocks: 10000,
        },
        end: {
          cumulativeWork: 0n,
          cumulativeBlockUnits: 0n,
          workPerThousandBlocks: 10000,
        },
        rounds: [],
      };
    else if (fn === "allowance")
      result =
        c.name === "Permit"
          ? [routerAllowance, now + 3600n, 0]
          : tokenAllowance;
    else if (fn === "quoteExactInputSingle") {
      if (quoteFails) throw Error("quote unavailable");
      result = [
        c.args[0].zeroForOne ? 900000000000000000000n : 1000000000000000n,
        200000n,
      ];
    } else if (fn === "approve")
      result = c.name === "Permit" ? undefined : true;
    else if (
      ["execute", "withdrawOwed", "redeemClaims", "failsafe"].includes(fn)
    )
      result = undefined;
    else if (fn in values) result = values[fn];
    else throw Error("Unmocked function " + fn);
    return encodeFunctionResult({ abi: c.abi, functionName: fn, result });
  }
  throw Error("Unmocked RPC " + method);
}
const { server, url } = await serve();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : {}),
});
const shots = root + "test/scratch/frontend-browser/";
mkdirSync(shots, { recursive: true });
let activePage;
const results = [];
const measurements = [];
const contrast = [];
const record = (name) => {
  results.push({ name, passed: true });
  console.log("PASS " + name);
};
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const routeHandler = async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "*",
        },
      });
    if (req.url().startsWith("https://api.squeekchain.com")) {
      if (activity === "offline") return route.abort();
      return route.fulfill({
        json: {
          schemaVersion: 1,
          measurement: {
            freshness: "online",
            observedAt: new Date(
              Date.now() - (activity === "stale" ? 180000 : 0),
            ).toISOString(),
            staleAfterSeconds: 120,
            rpmMilli: activity === "running" ? 12000 : 0,
          },
        },
      });
    }
    if (d.network.rpcUrls.some((u) => req.url().startsWith(u))) {
      const body = req.postDataJSON();
      const answer = (call) => {
        try {
          return {
            jsonrpc: "2.0",
            id: call.id,
            result: rpc(call.method, call.params),
          };
        } catch (e) {
          return {
            jsonrpc: "2.0",
            id: call.id,
            error: { code: -32000, message: e.message },
          };
        }
      };
      return route.fulfill({
        json: Array.isArray(body) ? body.map(answer) : answer(body),
      });
    }
    if (req.url().startsWith(url.replace("/preview/", "/")))
      return route.continue();
    // Prevent wallet SDK telemetry or any accidental live network while testing.
    return route.abort();
  };
  await context.route("**/*", routeHandler);
  await context.addInitScript(
    ({ player, chainId }) => {
      let chain = "0x1";
      let added = false;
      let authorized = false;
      const listeners = {};
      window.__walletCalls = [];
      window.__reject = true;
      window.__onSend = [];
      const emit = (name, value) =>
        (listeners[name] ?? []).forEach((fn) => fn(value));
      const provider = {
        on: (name, fn) => {
          (listeners[name] ??= []).push(fn);
        },
        removeListener: (name, fn) => {
          listeners[name] = (listeners[name] ?? []).filter((f) => f !== fn);
        },
        request: async ({ method, params }) => {
          window.__walletCalls.push({ method, params });
          if (method === "eth_chainId") return chain;
          if (method === "eth_accounts") return authorized ? [player] : [];
          if (method === "eth_requestAccounts") {
            authorized = true;
            return [player];
          }
          if (method === "wallet_switchEthereumChain") {
            if (!added) {
              const e = Error("Unknown chain");
              e.code = 4902;
              throw e;
            }
            chain = params[0].chainId;
            emit("chainChanged", chain);
            return null;
          }
          if (method === "wallet_addEthereumChain") {
            added = true;
            return null;
          }
          if (method === "wallet_getCapabilities") return {};
          if (method === "eth_sendTransaction") {
            if (window.__reject) {
              const e = Error("User rejected");
              e.code = 4001;
              throw e;
            }
            window.__onSend.push(params[0]);
            return "0x" + "12".repeat(32);
          }
          if (method === "eth_estimateGas") return "0x30000";
          if (method === "eth_gasPrice") return "0x1";
          if (method === "wallet_requestPermissions") return [];
          throw Error("Unmocked wallet " + method);
        },
      };
      window.ethereum = provider;
      window.__changeChain = (value) => {
        chain = value;
        emit("chainChanged", value);
      };
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent("eip6963:announceProvider", {
            detail: {
              info: {
                uuid: "10c089e7-2a7b-40b5-9932-b52810322008",
                name: "Mock Browser Wallet",
                icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
                rdns: "test.hamster.wallet",
              },
              provider,
            },
          }),
        );
      window.addEventListener("eip6963:requestProvider", announce);
      announce();
    },
    { player, chainId: d.chainId },
  );
  const page = await context.newPage();
  activePage = page;
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => {
    findings.push(e.message);
    console.log("SCRIPT ERROR", e.message);
  });
  page.on("requestfailed", (request) => {
    if (request.url().startsWith(url.replace("/preview/", "/"))) {
      if (request.failure()?.errorText.includes("ERR_ABORTED"))
        localNavigationAborts.push(request.url());
      else
        localFailures.push({
          url: request.url(),
          error: request.failure()?.errorText,
        });
    }
  });
  page.on("response", (response) => {
    if (
      response.url().startsWith(url.replace("/preview/", "/")) &&
      response.status() >= 400
    )
      localFailures.push(response.url());
  });
  await page.goto(url);
  await page.getByText("Prize pool", { exact: true }).waitFor();
  await page.getByText("Read at block", { exact: false }).waitFor();
  assert.equal(
    await page
      .locator("body")
      .evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Connect to trade" })
      .evaluate((e) => e.getBoundingClientRect().bottom <= innerHeight),
    true,
  );
  assert.equal(
    await page.getByText("Insufficient ETH balance.", { exact: true }).count(),
    0,
  );
  await page.screenshot({
    path: shots + "390-disconnected.png",
    fullPage: true,
  });
  record(
    "390px product, state and main action on first screen; disconnected balance is neutral",
  );
  measurements.push(
    await page.evaluate(() => {
      const box = (s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          bottom: r.bottom,
        };
      };
      return {
        state: "390px disconnected first screen",
        viewport: { width: innerWidth, height: innerHeight },
        product: box("h1"),
        wallet: box(".wallet-button"),
        mainAction: box(".trade .primary"),
        pot: box(".pot-bar"),
        content: box(".site-header"),
        scrollWidth: document.documentElement.scrollWidth,
      };
    }),
  );
  contrast.push(
    ...(await page.evaluate(() => {
      const rgb = (s) =>
        s
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number);
      const lum = (c) =>
        c
          .map((v) => {
            const x = v / 255;
            return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          })
          .reduce((a, x, i) => a + x * [0.2126, 0.7152, 0.0722][i], 0);
      return [
        ".identity p",
        ".pot-label",
        ".pot-number",
        ".trade .primary",
        ".trade-note",
      ].map((selector) => {
        const el = document.querySelector(selector),
          color = getComputedStyle(el).color;
        let e = el,
          background;
        while (e) {
          const bg = getComputedStyle(e).backgroundColor;
          if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
            background = bg;
            break;
          }
          e = e.parentElement;
        }
        const a = lum(rgb(color)),
          b = lum(rgb(background));
        return {
          selector,
          color,
          background,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        };
      });
    })),
  );

  await page.getByText("Nap beginning at round 650", { exact: true }).waitFor();
  assert.equal(
    await page.getByRole("link", { name: "View payout", exact: false }).count(),
    1,
  );
  record("Recent winner and payout link decode from the hook event log");
  await page.getByText("Core change log", { exact: true }).click();
  await page
    .getByText(`Block ${head} · Core changed`, { exact: true })
    .waitFor();
  assert.equal(
    await page
      .locator(".core-events a")
      .filter({ hasText: "View core event" })
      .count(),
    1,
  );
  assert.equal(
    await page.locator("#core .core-line a").getAttribute("href"),
    `${d.network.explorer}/address/${core}`,
  );
  assert.equal(
    await page.getByRole("button", { name: /Set core|Finalize core/ }).count(),
    0,
  );
  record(
    "New core getters and CoreChanged events render with explorer links; admin writes stay outside game UI",
  );

  const disconnectedAudit = await new AxeBuilder({ page }).analyze();
  accessibilityScans.push({
    state: "disconnected",
    violations: disconnectedAudit.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  });
  assert.equal(
    disconnectedAudit.violations.length,
    0,
    JSON.stringify(accessibilityScans),
  );
  await page.keyboard.press("Tab");
  for (
    let i = 0;
    i < 20 &&
    !(await page
      .locator(".wallet-button")
      .evaluate((e) => document.activeElement === e));
    i++
  )
    await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator(".wallet-button")
      .evaluate((e) => document.activeElement === e),
    true,
  );
  await page.screenshot({ path: shots + "390-keyboard-focus.png" });
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Browser wallet", exact: true })
      .count(),
    0,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await page
      .locator(".wallet-button")
      .evaluate((e) => document.activeElement === e),
    true,
  );
  record(
    "EIP-6963 discovery, keyboard Tab/Enter connection, modal Escape and focus restoration",
  );
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Mock Browser Wallet", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Review buy", exact: true }).waitFor();
  const walletCalls = await page.evaluate(() => window.__walletCalls);
  assert(
    walletCalls.some(
      (c) =>
        c.method === "wallet_addEthereumChain" &&
        JSON.stringify(c.params[0]) === JSON.stringify(d.walletAddChain),
    ),
  );
  assert(
    walletCalls.filter((c) => c.method === "wallet_switchEthereumChain")
      .length >= 2,
  );
  record(
    "Connect switches unknown chain via exact add-chain handoff then retries switch",
  );
  await page.getByRole("button", { name: "Review buy", exact: true }).click();
  await page.getByRole("button", { name: "Confirm buy", exact: true }).click();
  await page
    .getByText("Request declined in the wallet. You can try again.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Confirm buy", exact: true })
      .isEnabled(),
    true,
  );
  record(
    "Buy quotes, review, router simulation, wallet rejection and retry recovery",
  );
  const executeCall = calls.find(
    (c) =>
      c.method === "eth_call" &&
      c.params[0].to?.toLowerCase() === d.network.uniswapV4.universalRouter,
  );
  assert(executeCall);
  const parsed = decodeFunctionData({
    abi: abis.Router,
    data: executeCall.params[0].data,
  });
  assert.equal(parsed.args[0], "0x10");
  assert.equal(BigInt(executeCall.params[0].value), 1000000000000000n);
  record(
    "Buy simulation targets configured router with native value and V4 command",
  );
  await page.evaluate(() => window.__changeChain("0x1"));
  await page
    .locator(".wallet-button")
    .filter({ hasText: "Switch to Sepolia" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Confirm buy", exact: true })
      .count(),
    0,
  );
  record("Wrong-chain state replaces transaction action with chain switch");
  await page.locator(".wallet-button").click();
  await page.getByRole("button", { name: "Review buy", exact: true }).waitFor();
  await page.getByRole("button", { name: "Sell NAP", exact: true }).click();
  await page
    .getByRole("button", { name: "Approve NAP", exact: true })
    .waitFor();
  await page.evaluate(() => {
    window.__reject = false;
  });
  tokenAllowance = 1000000000000000000000n;
  await page.getByRole("button", { name: "Approve NAP", exact: true }).click();
  await page
    .getByRole("button", { name: "Allow NAP trading", exact: true })
    .waitFor();
  let sent = await page.evaluate(() => window.__onSend);
  let approval = decodeFunctionData({
    abi: abis.NapToken,
    data: sent.at(-1).data,
  });
  assert.equal(approval.functionName, "approve");
  assert.equal(approval.args[0].toLowerCase(), d.network.uniswapV4.permit2);
  assert.equal(approval.args[1], tokenAllowance);
  routerAllowance = tokenAllowance;
  await page
    .getByRole("button", { name: "Allow NAP trading", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review sell", exact: true })
    .waitFor();
  sent = await page.evaluate(() => window.__onSend);
  approval = decodeFunctionData({ abi: abis.Permit, data: sent.at(-1).data });
  assert.equal(approval.args[0].toLowerCase(), a);
  assert.equal(
    approval.args[1].toLowerCase(),
    d.network.uniswapV4.universalRouter,
  );
  record(
    "Sell exposes separate exact-amount ERC20→Permit2 and Permit2→router approvals, waits for receipts",
  );
  await page.getByRole("button", { name: "Review sell", exact: true }).click();
  await page.getByRole("button", { name: "Confirm sell", exact: true }).click();
  await page.waitForFunction(
    (router) => window.__onSend.at(-1)?.to.toLowerCase() === router,
    d.network.uniswapV4.universalRouter,
  );
  await page
    .locator(".trade .tx-feedback")
    .last()
    .getByText("Transaction confirmed.", { exact: true })
    .waitFor();
  sent = await page.evaluate(() => window.__onSend);
  assert.equal(
    sent.at(-1).to.toLowerCase(),
    d.network.uniswapV4.universalRouter,
  );
  assert(!sent.at(-1).value || BigInt(sent.at(-1).value) === 0n);
  record(
    "Sell executes through configured router with zero native value and confirmed feedback",
  );
  await page
    .getByRole("button", { name: "Claim settled nap", exact: true })
    .click();
  await page
    .locator(".claims .tx-feedback")
    .filter({ hasText: "Transaction confirmed." })
    .first()
    .waitFor();
  sent = await page.evaluate(() => window.__onSend);
  const claim = decodeFunctionData({
    abi: abis.HamsterNap3D,
    data: sent.at(-1).data,
  });
  assert.equal(claim.functionName, "settleNaps");
  assert.equal(claim.args[0], 8n);
  record("Claim processes certified naps in order using bounded pages");
  await page
    .getByText("Refunds, pot claims & failsafe", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Withdraw owed ETH", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Withdraw owed ETH", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Redeem pot claims", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Redeem pot claims", exact: true })
    .waitFor();
  failSafeOpen = true;
  await page
    .getByRole("button", { name: "Refresh state", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Claim failsafe", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Claim failsafe", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Claim failsafe", exact: true })
    .waitFor();
  record(
    "Deferred withdrawal, claim redemption and stale-core failsafe controls simulate and submit",
  );
  const utilitySent = await page.evaluate(() => window.__onSend);
  for (const name of ["withdrawOwed", "redeemClaims", "failsafe"])
    assert(
      utilitySent.some((t) => {
        try {
          return (
            decodeFunctionData({ abi: abis.HamsterNap3D, data: t.data })
              .functionName === name
          );
        } catch {
          return false;
        }
      }),
      `missing submitted ${name}`,
    );
  const connectedAudit = await new AxeBuilder({ page }).analyze();
  accessibilityScans.push({
    state: "connected, utility controls expanded",
    violations: connectedAudit.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  });
  assert.equal(
    connectedAudit.violations.length,
    0,
    JSON.stringify(accessibilityScans),
  );
  record(
    "Axe accessibility scans: no violations in disconnected and connected expanded states",
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo(0, 0));
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `overflow ${width}`,
    );
    await page.screenshot({
      path: shots + `${width}-connected.png`,
      fullPage: true,
    });
    const barAtTop = await page.locator(".pot-bar").boundingBox();
    assert.equal(barAtTop.y, 0);
    assert(barAtTop.height > 0 && barAtTop.height < 320);
    const contentTop = await page.locator(".site-header").boundingBox();
    assert(contentTop.y >= barAtTop.height);
    for (const fraction of [0.25, 0.5, 1]) {
      await page.evaluate(
        (f) =>
          scrollTo(
            0,
            (document.documentElement.scrollHeight - innerHeight) * f,
          ),
        fraction,
      );
      const box = await page.locator(".pot-bar").boundingBox();
      assert.equal(box.y, 0, `pot fixed at ${width}/${fraction}`);
      assert.equal(box.height, barAtTop.height);
      measurements.push({
        state: "connected scroll",
        width,
        fraction,
        pot: box,
      });
      const potBox = await page.locator(".pot-value").boundingBox();
      assert(potBox.y >= 0 && potBox.y + potBox.height <= box.height);
    }
    await page.screenshot({ path: shots + `${width}-bottom-pot.png` });
    await page.evaluate(() => scrollTo(0, 0));
  }
  record(
    "Pot remains fixed and fully visible at 25%, 50% and 100% scroll with reserved initial content space at all tested widths",
  );
  record(
    "No horizontal overflow at 320, 390, 768 and 1440 with connected state",
  );
  const originals = await page.evaluate(() => {
    const pot = document.querySelector(".pot-number");
    const buyer = document.querySelector(".latest .address-wrap a");
    const balance = document.querySelector(".amount-head .small");
    const before = [pot.textContent, buyer.textContent, balance.textContent];
    pot.textContent = "999,999,999,999,999.999999999999999999";
    buyer.textContent = buyer.title;
    balance.textContent = "Balance: 999,999,999,999,999.999999999999999999";
    return before;
  });
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  await page.screenshot({
    path: shots + "390-long-values.png",
    fullPage: true,
  });
  await page.evaluate((before) => {
    document.querySelector(".pot-number").textContent = before[0];
    document.querySelector(".latest .address-wrap a").textContent = before[1];
    document.querySelector(".amount-head .small").textContent = before[2];
  }, originals);
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));
  record(
    "Large balances, full address and 200% text enlargement reflow without horizontal scrolling",
  );
  assert.equal(
    await page
      .locator(".pot-value")
      .evaluate((e) => getComputedStyle(e).fontVariantNumeric),
    "tabular-nums",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
    "auto",
  );
  record("Reduced-motion media setting disables smooth scrolling");
  quoteFails = true;
  await page.getByRole("button", { name: "Buy NAP", exact: true }).click();
  await page
    .locator(".trade")
    .getByText("Quote unavailable.", { exact: false })
    .waitFor({ timeout: 20000 });
  assert.equal(
    await page
      .getByRole("button", { name: "Review buy", exact: true })
      .isDisabled(),
    true,
  );
  record("Quote failure is persistent, recoverable and prevents signing");
  quoteFails = false;
  coreFails = true;
  await page
    .getByRole("button", { name: "Refresh state", exact: true })
    .click();
  await page
    .getByText("Certified round data is unavailable.", { exact: false })
    .first()
    .waitFor();
  await page.getByRole("button", { name: "Sell NAP", exact: true }).click();
  await page
    .getByRole("button", { name: "Review sell", exact: true })
    .waitFor();
  record(
    "Core failure shows unknown certified state while sell remains available",
  );
  activity = "offline";
  await page.reload();
  await page.locator(".status-pill.offline").waitFor();
  record("Offline API is labeled separately from certified chain state");
  activity = "stale";
  finalized = true;
  await page.reload();
  await page.locator(".status-pill.stale").waitFor();
  await page
    .locator("#core .status-pill")
    .filter({ hasText: /^Finalized$/ })
    .waitFor();
  await page.getByText("Core change log", { exact: true }).click();
  await page
    .getByText(`Block ${head} · Core finalized`, { exact: true })
    .waitFor();
  record(
    "Finalized core state and CoreFinalized event refresh from chain reads",
  );
  record("Old activity measurements are marked stale");
  codeMissing = true;
  await page.reload();
  await page
    .getByText("Deployment verification unavailable.", { exact: false })
    .waitFor({ timeout: 30000 });
  record(
    "Missing deployed code disables trading with visible recovery guidance",
  );
  codeMissing = false;
  coreFails = false;
  activity = "running";
  await page.reload();
  await page.locator(".status-pill.running").waitFor();
  await page.locator(".rpm").filter({ hasText: "12.0" }).waitFor();
  record(
    "Running activity reports the measured RPM independently from certified progress",
  );
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  });
  await mobile.route("**/*", routeHandler);
  const mobilePage = await mobile.newPage();
  mobilePage.setDefaultTimeout(15000);
  await mobilePage.goto(url);
  await mobilePage
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  for (const name of ["MetaMask", "Coinbase Wallet", "Rabby", "Phantom"])
    await mobilePage
      .getByRole("link", { name: `Open in ${name}`, exact: false })
      .waitFor();
  await mobilePage
    .getByRole("button", { name: "Coinbase Smart Wallet", exact: true })
    .waitFor();
  assert.equal(
    await mobilePage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await mobilePage.screenshot({ path: shots + "390-mobile-wallets.png" });
  await mobile.close();
  record(
    "Phone browser without injection offers all four wallet-browser links and Coinbase Smart Wallet",
  );
  const noWallet = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await noWallet.route("**/*", routeHandler);
  const noWalletPage = await noWallet.newPage();
  noWalletPage.setDefaultTimeout(15000);
  await noWalletPage.goto(url);
  await noWalletPage
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await noWalletPage
    .getByText(
      "No browser wallet detected. Install an extension or choose Coinbase Wallet below.",
      { exact: true },
    )
    .waitFor();
  await noWalletPage
    .getByRole("button", { name: "Browser wallet", exact: true })
    .click();
  await noWalletPage
    .getByRole("alert")
    .filter({ hasText: "No browser wallet detected." })
    .waitFor();
  await noWallet.close();
  const badAbi = await browser.newContext();
  await badAbi.route("**/*", async (route) => {
    if (route.request().url().endsWith("/abi/HamsterNap3D.json"))
      return route.fulfill({ json: [] });
    return routeHandler(route);
  });
  const badPage = await badAbi.newPage();
  await badPage.goto(url);
  await badPage
    .getByRole("alert")
    .filter({ hasText: "ABI verification failed" })
    .waitFor();
  assert.equal(
    await badPage
      .getByRole("button", { name: /Review buy|Confirm buy/ })
      .count(),
    0,
  );
  await badAbi.close();
  record(
    "Corrupt implementation ABI blocks startup and signing with a visible reload path",
  );
  record(
    "Desktop missing-wallet state explains recovery and keeps Coinbase available",
  );
  assert.equal(localFailures.length, 0, JSON.stringify(localFailures));
  assert.equal(findings.length, 0, findings.join("\n"));
  record("No browser script errors in validated interactions");
  await context.close();
  writeFileSync(
    root + "docs/frontend/browser-results.json",
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        mode: "Production export at /preview/, Chromium, mocked wallet and RPC. No broadcasts.",
        results,
        scriptErrors: findings,
        localResourceFailures: localFailures,
        cancelledRequestsDuringNavigation: localNavigationAborts.length,
        accessibilityScans,
        measurements,
        contrast,
        screenshots:
          "test/scratch/frontend-browser/ (ephemeral); selected final evidence retained under docs/frontend/",
      },
      null,
      2,
    ) + "\n",
  );
} catch (error) {
  console.error(error);
  if (activePage) {
    await activePage.screenshot({
      path: shots + "failure.png",
      fullPage: true,
    });
    writeFileSync(
      shots + "failure-body.txt",
      await activePage.locator("body").innerText(),
    );
    writeFileSync(
      shots + "wallet-calls.json",
      JSON.stringify(
        await activePage.evaluate(() => window.__walletCalls),
        null,
        2,
      ),
    );
  }
  writeFileSync(shots + "rpc-calls.json", JSON.stringify(calls, null, 2));
  writeFileSync(shots + "failure.txt", String(error));
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
