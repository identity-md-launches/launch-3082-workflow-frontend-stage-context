import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import {
  createPublicClient,
  custom,
  getAddress,
  type Address,
  type PublicClient,
} from "viem";
import type { Runtime } from "./config";
import { CONSOLE_URL, STATUS_URL } from "./config";
import { amountLabel, parseLiveStatus, friendlyError } from "./protocol";
import {
  hasBuyer,
  loadGame,
  loadHistory,
  loadLatestBuyTime,
  verifyDeployment,
  type GameState,
} from "./reads";
import { Wallet, shortAddress } from "./Wallet";
import { Trade, TxFeedback } from "./Trade";
import { useTransaction } from "./transactions";
function AddressLink({ address, r }: { address: Address; r: Runtime }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="address-wrap">
      <a
        href={`${r.deployment.network.explorer}/address/${address}`}
        target="_blank"
        rel="noreferrer"
        title={getAddress(address)}
        aria-label={`View ${getAddress(address)} on Etherscan`}
      >
        {shortAddress(address)} ↗
      </a>
      <button
        type="button"
        className="copy"
        aria-label={`Copy ${getAddress(address)}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(getAddress(address));
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
function ago(timestamp: bigint, now: number) {
  const seconds = Math.max(0, Math.floor(now / 1000) - Number(timestamp));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}
function Claims({
  r,
  game,
  ready,
  onConnect,
}: {
  r: Runtime;
  game?: GameState;
  ready: boolean;
  onConnect: () => void;
}) {
  const { isConnected, chainId } = useAccount();
  const tx = useTransaction(r);
  const withdraw = useTransaction(r);
  const redeem = useTransaction(r);
  const failsafe = useTransaction(r);
  const connected = isConnected && chainId === r.chain.id;
  const canProcess =
    game &&
    game.scan > 0n &&
    game.frontier !== undefined &&
    game.scan <= game.frontier &&
    !game.claimError;
  const canFailsafe =
    game &&
    game.scan > 0n &&
    game.timestamp >= game.opens &&
    game.failsafeWinner[1] > 0n;
  const action = (fn: string) => ({
    address: r.contracts.HamsterNap3D.address,
    abi: r.contracts.HamsterNap3D.abi,
    functionName: fn,
    args: fn === "settleNaps" ? [8n] : [],
  });
  return (
    <section className="claims" aria-labelledby="claim-title">
      <div className="section-head">
        <div>
          <h2 id="claim-title">Settle & collect</h2>
          <p className="muted">
            Anyone can claim. The contract pays the winner.
          </p>
        </div>
        <span className="claim-mark" aria-hidden="true">
          ↗
        </span>
      </div>
      <div className="claim-row">
        <div>
          <h3>
            {game?.claimable && game.claimable > 0n
              ? "A settled nap is ready"
              : "Waiting for a settled nap"}
          </h3>
          <p className="muted small">
            {game?.scan === 0n
              ? "The first swap starts the game."
              : (game?.claimError ??
                game?.coreError ??
                (canProcess
                  ? "Process up to 128 certified rounds, in order."
                  : "Newly certified rounds appear here automatically."))}
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={(connected && (!ready || !canProcess)) || tx.busy}
          onClick={() =>
            connected ? void tx.run(action("settleNaps")) : onConnect()
          }
        >
          {tx.busy
            ? "Processing…"
            : !connected
              ? "Connect to claim"
              : game?.claimable && game.claimable > 0n
                ? "Claim settled nap"
                : "Process settled rounds"}
        </button>
      </div>
      <TxFeedback r={r} tx={tx} />
      <details id="credits">
        <summary>Refunds, pot claims & failsafe</summary>
        <div className="utility-row">
          <div>
            <h3>Deferred payout or refund</h3>
            <p className="muted small">
              {game ? amountLabel(game.owed) : "…"} ETH available to this
              wallet. Includes unused buy-fee reservations.
            </p>
          </div>
          <button
            type="button"
            className="secondary"
            disabled={!ready || !connected || !game?.owed || withdraw.busy}
            onClick={() => void withdraw.run(action("withdrawOwed"))}
          >
            {withdraw.busy ? "Withdrawing…" : "Withdraw owed ETH"}
          </button>
        </div>
        <TxFeedback r={r} tx={withdraw} />
        <div className="utility-row">
          <div>
            <h3>Redeem the pot’s ETH claims</h3>
            <p className="muted small">
              {game ? amountLabel(game.claims) : "…"} ETH in PoolManager claims.
              Already included in the pot; redemption pays the hook.
            </p>
          </div>
          <button
            type="button"
            className="secondary"
            disabled={!ready || !connected || !game?.claims || redeem.busy}
            onClick={() => void redeem.run(action("redeemClaims"))}
          >
            {redeem.busy ? "Redeeming…" : "Redeem pot claims"}
          </button>
        </div>
        <TxFeedback r={r} tx={redeem} />
        <div className="utility-row">
          <div>
            <h3>Seven-day failsafe</h3>
            <p className="muted small">
              {game?.scan === 0n
                ? "Starts with the first swap."
                : game
                  ? `Earliest opening: ${new Date(Number(game.opens) * 1000).toLocaleString()}. A new observed frontier advance resets it.`
                  : "Loading the failsafe window."}{" "}
              Pays only the eligible buyer; later fees stay for the next game.
            </p>
            {game && hasBuyer(game.failsafeWinner[0]) && (
              <p className="small">
                Eligible now:{" "}
                <AddressLink r={r} address={game.failsafeWinner[0]} /> ·{" "}
                {amountLabel(game.failsafeWinner[1])} ETH, before any pending
                naps.
              </p>
            )}
          </div>
          <button
            type="button"
            className="secondary"
            disabled={!ready || !connected || !canFailsafe || failsafe.busy}
            onClick={() => void failsafe.run(action("failsafe"))}
          >
            {failsafe.busy ? "Checking failsafe…" : "Claim failsafe"}
          </button>
        </div>
        <TxFeedback r={r} tx={failsafe} />
        <p className="muted small">
          Connect on Sepolia to use these controls. Each action is simulated
          first. Claims that cannot be delivered become a withdrawal credit.
        </p>
      </details>
    </section>
  );
}
export default function App({ r }: { r: Runtime }) {
  const { address, chainId, connector } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [fallbackClient, setFallbackClient] = useState<PublicClient>();
  const [openWallet, setOpenWallet] = useState<() => void>(() => () => {});
  const potBar = useRef<HTMLElement>(null);
  useEffect(() => {
    const bar = potBar.current;
    if (!bar) return;
    const update = () =>
      document.documentElement.style.setProperty(
        "--pot-bar-height",
        `${bar.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    update();
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--pot-bar-height");
    };
  }, []);
  const [clock, setClock] = useState(Date.now());
  const [historyBefore, setHistoryBefore] = useState<bigint>();
  const setOpener = useCallback(
    (fn: () => void) => setOpenWallet(() => fn),
    [],
  );
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setFallbackClient(undefined);
    if (
      connector &&
      typeof connector.getProvider === "function" &&
      chainId === r.chain.id
    )
      void connector
        .getProvider()
        .then((p) => {
          if (!cancelled)
            setFallbackClient(
              createPublicClient({
                chain: r.chain,
                transport: custom(p as Parameters<typeof custom>[0]),
              }) as PublicClient,
            );
        })
        .catch(() => {
          if (!cancelled) setFallbackClient(undefined);
        });
    return () => {
      cancelled = true;
    };
  }, [connector, chainId, r.chain]);
  const verified = useQuery({
    queryKey: ["verification"],
    queryFn: () => verifyDeployment(r),
    retry: 1,
    staleTime: 300000,
    refetchInterval: 300000,
  });
  const game = useQuery({
    queryKey: ["game", address],
    queryFn: async () => {
      try {
        return await loadGame(r, address);
      } catch (e) {
        if (fallbackClient && walletClient)
          return loadGame(r, address, fallbackClient);
        throw e;
      }
    },
    retry: 1,
    refetchInterval: 12000,
  });
  const live = useQuery({
    queryKey: ["hamster"],
    queryFn: async () => {
      const response = await fetch(STATUS_URL, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw Error("Activity feed offline");
      return (await response.json()) as unknown;
    },
    refetchInterval: 10000,
    retry: 0,
  });
  const history = useQuery({
    queryKey: ["history", historyBefore?.toString()],
    queryFn: () => loadHistory(r, historyBefore),
    retry: 1,
    refetchInterval: 60000,
  });
  const status = live.isError
    ? { state: "offline" as const }
    : parseLiveStatus(live.data, clock);
  const state = game.data;
  const fresh = !!state && !game.isError && clock - game.dataUpdatedAt < 45000;
  const buyerTime = useQuery({
    queryKey: ["buyer-time", state?.latest, state?.buyCount.toString()],
    enabled: !!state && hasBuyer(state.latest),
    queryFn: ({ signal }) => loadLatestBuyTime(r, state!, signal),
    staleTime: Infinity,
    retry: 1,
  });
  const winners =
    history.data?.entries
      .filter((e) => e.kind === "nap" || e.kind === "failsafe")
      .slice(0, 6) ?? [];
  const openConnect = () => {
    if (address && chainId !== r.chain.id) {
      document.querySelector<HTMLButtonElement>(".wallet-button")?.click();
    } else openWallet();
  };
  const coreEvents =
    history.data?.entries.filter(
      (e) => e.kind === "coreChanged" || e.kind === "coreFinalized",
    ) ?? [];
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to game
      </a>
      <aside ref={potBar} className="pot-bar" aria-label="Live prize pool">
        <div className="pot-bar-inner">
          <div className="pot">
            <div className="pot-label">
              <span>Prize pool</span>
              <span className="small muted">
                {fresh
                  ? "Live · Sepolia"
                  : state
                    ? "Stale · last read"
                    : "Connecting…"}
              </span>
            </div>
            <p className="pot-value numeric">
              <span className="pot-number">
                {state ? amountLabel(state.pot, 18, 6) : "…"}
              </span>{" "}
              <span className="pot-unit">ETH</span>
            </p>
          </div>
          <div className="latest">
            <span className="small muted">Latest qualifying buyer</span>
            <div className="buyer-value">
              {state && hasBuyer(state.latest) ? (
                <AddressLink address={state.latest} r={r} />
              ) : state ? (
                "No qualifying buyer"
              ) : (
                "Reading…"
              )}
            </div>
            <span className="small muted">
              {state && hasBuyer(state.latest)
                ? buyerTime.data
                  ? `Bought ${ago(buyerTime.data, clock)}`
                  : buyerTime.isError
                    ? "Buy time unavailable"
                    : "Reading buy time…"
                : "Buy ≥ 0.001 ETH to qualify"}
            </span>
          </div>
          <div className="nap-counter">
            <div className="nap-heading">
              <span className="small muted">Zero-work rounds</span>
              <strong className="numeric">
                {state?.napProgress !== undefined ? state.napProgress : "?"}
                <span className="muted"> / 3</span>
              </strong>
            </div>
            <div
              className="nap-segments"
              role="group"
              aria-label={
                state?.napProgress !== undefined
                  ? `${state.napProgress} of 3 settled zero-work rounds`
                  : "Certified progress unknown"
              }
            >
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={
                    state?.napProgress !== undefined && state.napProgress >= n
                      ? "active"
                      : ""
                  }
                />
              ))}
            </div>
            <span className="small muted">Settled onchain</span>
          </div>
        </div>
      </aside>
      <div className="page-shell">
        <header className="site-header">
          <div className="identity">
            <a href="#main" className="brand">
              <img src="./favicon.svg" alt="" width="28" height="28" />
              <h1>Hamster Nap 3D</h1>
            </a>
            <p className="small muted">
              NAP · Last buyer before three zero-work rounds.
            </p>
          </div>
          <Wallet r={r} onOpenReady={setOpener} />
        </header>
        <nav className="page-nav" aria-label="Main navigation">
          <a href="#trade">Trade</a>
          <a href="#claim-title">Claim</a>
          <a href="#winners">Winners</a>
          <a href="#core">Core</a>
          <a href="#how">Rules</a>
          <span className="network-label">Sepolia testnet</span>
        </nav>
        <main id="main">
          <div className="arena">
            <section className="game-board panel" aria-labelledby="live-title">
              <div className="section-head">
                <h2 id="live-title">Squeektoshi live</h2>
                <span className={`status-pill ${status.state}`}>
                  <span aria-hidden="true" />
                  {live.isPending
                    ? "Loading"
                    : status.state[0].toUpperCase() + status.state.slice(1)}
                </span>
              </div>
              <div className="telemetry">
                <div className="feed-source">
                  <span className="small muted">Activity feed</span>
                  <span className="small muted">10s refresh</span>
                </div>
                <p className="numeric rpm">
                  {status.rpm !== undefined ? status.rpm.toFixed(1) : "…"}
                  <span className="small muted"> wheel RPM</span>
                </p>
              </div>
              <p className="small muted">
                {status.state === "resting"
                  ? "Zero wheel activity. Only settled core rounds count."
                  : status.state === "running"
                    ? "Wheel activity detected. Certified progress is separate."
                    : "Activity feed unavailable or out of date. Chain reads continue."}
              </p>
              <a href={CONSOLE_URL} target="_blank" rel="noreferrer">
                Open SqueekChain console ↗
              </a>
              <div className="frontier">
                <div>
                  <span className="small muted">Certified frontier</span>
                  <strong className="numeric">
                    {state?.frontier !== undefined
                      ? `#${state.frontier}`
                      : "Unknown"}
                  </strong>
                </div>
                <div>
                  <span className="small muted">Next round to scan</span>
                  <strong className="numeric">
                    {state?.scan
                      ? `#${state.scan}`
                      : state
                        ? "Not started"
                        : "…"}
                  </strong>
                </div>
              </div>
              <div className="read-status small">
                <span>
                  {game.isFetching
                    ? "Refreshing chain state…"
                    : fresh
                      ? `Read at block ${state?.block}`
                      : state
                        ? "Last read is stale"
                        : "Connecting to public RPC…"}
                </span>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    void game.refetch();
                    void verified.refetch();
                  }}
                  disabled={game.isFetching}
                >
                  Refresh state
                </button>
              </div>
              {state?.coreError && (
                <p className="error small" role="status">
                  {state.coreError}
                </p>
              )}
              {game.isError && (
                <p className="error small" role="alert">
                  Unable to read live game state. Check your connection and
                  refresh. Previously shown values may be stale.
                </p>
              )}
              {verified.isError && (
                <p className="error small" role="alert">
                  Deployment verification unavailable. Trading is disabled.{" "}
                  {friendlyError(verified.error)}
                </p>
              )}
            </section>
            <Trade
              r={r}
              game={state}
              verified={verified.data === true && !verified.isError}
              fresh={fresh}
              onConnect={openConnect}
            />
          </div>
          <Claims
            r={r}
            game={state}
            ready={verified.data === true && !verified.isError && fresh}
            onConnect={openConnect}
          />
          <section
            id="winners"
            className="winners"
            aria-labelledby="winners-title"
          >
            <div className="section-head">
              <h2 id="winners-title">Recent winners</h2>
              <span className="small muted">
                {state ? `${state.naps} naps settled` : "Reading history"}
              </span>
            </div>
            {history.isPending ? (
              <p className="empty-state">Loading the event log…</p>
            ) : history.isError ? (
              <div className="empty-state">
                <p className="error">
                  Winner history could not be loaded. This does not mean there
                  are no winners.
                </p>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void history.refetch()}
                >
                  Retry history
                </button>
              </div>
            ) : winners.length ? (
              <ul className="winner-list">
                {winners.map((w) => (
                  <li key={`${w.hash}-${w.logIndex}`}>
                    <div>
                      {hasBuyer(w.winner) ? (
                        <AddressLink address={w.winner} r={r} />
                      ) : (
                        <span>No qualifying buyer</span>
                      )}
                      <span className="small muted">
                        {w.kind === "nap"
                          ? `Nap beginning at round ${w.round}`
                          : "Seven-day failsafe"}
                      </span>
                    </div>
                    <div className="winner-amount numeric">
                      {amountLabel(w.amount)} ETH
                      <a
                        className="small"
                        href={`${r.deployment.network.explorer}/tx/${w.hash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View payout ↗
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">
                No winners in this event window yet.
              </p>
            )}
            <div className="history-footer small muted">
              <span>
                {history.data
                  ? `Event window: blocks ${history.data.from}–${history.data.to}`
                  : "Public RPC event history"}
              </span>
              <button
                type="button"
                className="text-button"
                disabled={
                  !history.data ||
                  history.data.from === 0n ||
                  history.isFetching
                }
                onClick={() => {
                  if (history.data) setHistoryBefore(history.data.from - 1n);
                }}
              >
                Load older events
              </button>
              {historyBefore !== undefined && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setHistoryBefore(undefined)}
                >
                  Back to latest
                </button>
              )}
            </div>
          </section>
          <section
            className="core-section"
            id="core"
            aria-labelledby="core-title"
          >
            <div className="section-head">
              <h2 id="core-title">Core the hook reads</h2>
              <span className="status-pill">
                {fresh && state
                  ? state.coreFinalized
                    ? "Finalized"
                    : "Not finalized"
                  : "Status unknown"}
              </span>
            </div>
            <div className="core-line">
              {state ? (
                <AddressLink address={state.core} r={r} />
              ) : (
                <span className="muted">Reading core address…</span>
              )}
              <span className="small muted">
                {state
                  ? `${state.roundDuration.toString()}s rounds · ${fresh ? "Current read" : "Last read"}`
                  : "Live from the hook"}
              </span>
            </div>
            <p className="small muted">
              {state?.coreFinalized
                ? "Core selection is permanent. External proxy upgrades remain possible."
                : "Until finalization, the owner can switch cores, affect winner selection and restart the seven-day failsafe."}
            </p>
            {state && (
              <div className="owner-line small">
                <span className="muted">Immutable owner</span>
                <AddressLink address={state.owner} r={r} />
              </div>
            )}
            <details>
              <summary>Core change log</summary>
              {history.isError ? (
                <p className="error small">
                  Core event history is unavailable.{" "}
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void history.refetch()}
                  >
                    Retry core history
                  </button>
                </p>
              ) : history.isPending ? (
                <p className="small muted">Loading core events…</p>
              ) : coreEvents.length ? (
                <ul className="core-events">
                  {coreEvents.map((e) => (
                    <li key={`${e.hash}-${e.logIndex}`}>
                      <span className="small muted">
                        Block {e.block.toString()} ·{" "}
                        {e.kind === "coreChanged"
                          ? "Core changed"
                          : "Core finalized"}
                      </span>
                      <div>
                        {e.oldCore && (
                          <>
                            <AddressLink address={e.oldCore} r={r} />
                            <span aria-hidden="true"> → </span>
                          </>
                        )}
                        {e.newCore && <AddressLink address={e.newCore} r={r} />}
                      </div>
                      <a
                        className="small"
                        href={`${r.deployment.network.explorer}/tx/${e.hash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View core event ↗
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small muted">
                  No core changes or finalizations in the displayed event
                  window.
                </p>
              )}
              <p className="small muted">
                Uses the same block window as Recent winners. Load older events
                above to look further back.
              </p>
            </details>
          </section>
          <section id="how" className="how" aria-labelledby="how-title">
            <h2 id="how-title">Rules</h2>
            <ol>
              <li>
                Buy at least 0.001 ETH to take the latest-buyer slot. Every buy
                adds 2% of executed gross ETH to the pot. Sells pay no game fee.
              </li>
              <li>
                Three consecutive settled zero-work rounds certify a nap. The
                last qualifying buyer before its first round wins fees collected
                before that start. One payout per continuous zero-work run.
              </li>
              <li>
                Anyone can settle. The contract picks the winner. Failed payouts
                become withdrawable credits; buys during a nap count toward
                later payouts.
              </li>
              <li>
                A stalled core opens a seven-day failsafe. Process certified
                naps first. The eligible historical buyer receives fees through
                the cutoff.
              </li>
            </ol>
          </section>
          <section
            className="contracts"
            id="contracts"
            aria-labelledby="contracts-title"
          >
            <h2 id="contracts-title">Contracts</h2>
            <div className="contract-links">
              {r.deployment.contracts.map((c) => (
                <div key={c.name}>
                  <span>
                    {c.name === "NapToken" ? "NAP token" : "Game hook"}
                  </span>
                  <AddressLink address={c.address} r={r} />
                </div>
              ))}
            </div>
            <p className="small muted">
              No owner withdrawal, fee change, pause or hook upgrade. Sells do
              not depend on the core. Pool fee: 1.25%.
            </p>
            <div className="resources">
              <a href="./imd-deployment.json" target="_blank" rel="noreferrer">
                Deployment & ABIs ↗
              </a>
              <a
                href={r.deployment.network.faucets[0]}
                target="_blank"
                rel="noreferrer"
              >
                Get test ETH ↗
              </a>
            </div>
          </section>
        </main>
        <footer>
          <span>Hamster Nap 3D · NAP</span>
          <p>
            Unofficial community game. Not affiliated with SqueekChain.
            <br />
            Sepolia test tokens have no value. No promise of profit.
          </p>
        </footer>
      </div>
    </>
  );
}
