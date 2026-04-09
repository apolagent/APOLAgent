import { Telegraf } from "telegraf";
import { storage } from "./storage";

// ─── Constants ────────────────────────────────────────────────────────────────

const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1";
const BASE_CHAIN_ID = "8453";
const BOT_RPC_URL = process.env.BASE_RPC_URL || "";
const UNISWAP_V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD";
const UNISWAP_V4_POOL_MANAGER = "0x498581ff718922c3f8e6a244956af099b2652b2b";
const WETH_BASE = "0x4200000000000000000000000000000000000006";
const FEE_TIERS = [500, 3000, 10000, 100];

const BOT_ERC8183_VAULT = "0xdad686299fb562f89e55da05f1d96fabeb2a2e32";
const BOT_OFFICIAL_APOL_CA = "";
const BOT_OFFICIAL_APOL_TWITTER = "@ApolAgent_";

function getSiteUrl(): string {
  return "https://apolagent.online";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isEvmAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/i.test(addr.trim());
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function esc(text: string): string {
  return text.replace(/[_*`\[\]]/g, "");
}

function stripMd(text: string): string {
  return text.replace(/[_*`]/g, "");
}

function pct(raw: string | undefined): string {
  const n = parseFloat(raw || "0");
  return isNaN(n) ? "0%" : `${(n * 100).toFixed(1)}%`;
}

function flag(v: any): boolean {
  return v === "1" || v === 1 || v === true;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPrice(n: number): string {
  if (n <= 0 || isNaN(n)) return "N/A";
  if (n >= 1)    return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(10).replace(/0+$/, "")}`;
}

function fmtMcap(price: number, supply: number | null): string {
  if (!supply || supply <= 0 || price <= 0 || isNaN(price) || isNaN(supply)) return "Data Pending";
  const mcap = price * supply;
  if (mcap >= 1_000_000_000) return `$${(mcap / 1_000_000_000).toFixed(2)}B`;
  if (mcap >= 1_000_000)     return `$${(mcap / 1_000_000).toFixed(2)}M`;
  if (mcap >= 1_000)         return `$${(mcap / 1_000).toFixed(1)}K`;
  return `$${mcap.toFixed(2)}`;
}

// ─── Platform Locker / Deployer Maps (Base V3/V4 launchpads) ────────────────

const BOT_PLATFORM_LOCKERS: Record<string, string> = {
  "0x0bf8edd756ff6caf3f583d67a9fd8b237e40f58a": "ApeStore",
  "0xe85a59c628f7d27878aceb4bf3b35733630083a9": "Clanker v4",
  "0xf3622742b1e446d92e45e22923ef11c2fcd55d68": "Clanker v4",
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": "Virtuals",
  "0xdad686299fb562f89e55da05f1d96fabeb2a2e32": "Virtuals",
  "0x39112541720078c70164ea4deb61f0a4811910f9": "Flaunch",
};

const BOT_PLATFORM_DEPLOYERS: Record<string, string> = {
  "0xade256e1c2763b8766efe1eeb7c578d93f621f6f": "ApeStore",
  "0xd46618f35099074c5a456b21d2967a6ff6841bd3": "Clanker v4",
  "0x97cf38bb06da57b6418083998b09976ec40a90a3": "Virtuals",
  "0xdad686299fb562f89e55da05f1d96fabeb2a2e32": "Virtuals",
  "0x71b8efc8bcad65a5d9386d07f2dff57ab4eaf533": "Virtuals",
  "0x9547e85f3016303a2996271314bde78b02021a28": "Virtuals",
  "0x39112541720078c70164ea4deb61f0a4811910f9": "Flaunch",
};

const ALL_BOT_FACTORY_ADDRESSES = new Set([
  ...Object.keys(BOT_PLATFORM_LOCKERS).map(a => a.toLowerCase()),
  ...Object.keys(BOT_PLATFORM_DEPLOYERS).map(a => a.toLowerCase()),
]);

// ─── Alchemy RPC helpers ─────────────────────────────────────────────────────

async function botRpcCall(method: string, params: any[]): Promise<any> {
  if (!BOT_RPC_URL) return null;
  try {
    const r = await fetch(BOT_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const j = await r.json() as any;
    return j.result ?? null;
  } catch { return null; }
}

async function botCheckUniV3Pool(tokenAddress: string): Promise<boolean> {
  if (!BOT_RPC_URL) return false;
  const GET_POOL_SIG = "0x1698ee82";
  const addrA = tokenAddress.toLowerCase() < WETH_BASE.toLowerCase() ? tokenAddress : WETH_BASE;
  const addrB = tokenAddress.toLowerCase() < WETH_BASE.toLowerCase() ? WETH_BASE : tokenAddress;
  const padA = addrA.replace("0x", "").padStart(64, "0");
  const padB = addrB.replace("0x", "").padStart(64, "0");
  const results = await Promise.all(
    FEE_TIERS.map(fee => {
      const padFee = fee.toString(16).padStart(64, "0");
      const data = `${GET_POOL_SIG}${padA}${padB}${padFee}`;
      return botRpcCall("eth_call", [{ to: UNISWAP_V3_FACTORY, data }, "latest"]);
    })
  );
  return results.some(r => r && r !== "0x" + "0".repeat(64) && r !== "0x");
}

const BOT_V4_DEPLOY_BLOCK = "0x16E3600";

async function botCheckUniV4Pool(tokenAddress: string): Promise<boolean> {
  if (!BOT_RPC_URL) return false;
  const padToken = "0x" + tokenAddress.replace("0x", "").toLowerCase().padStart(64, "0");
  const [asCurrency0, asCurrency1] = await Promise.all([
    botRpcCall("eth_getLogs", [{
      address: UNISWAP_V4_POOL_MANAGER,
      fromBlock: BOT_V4_DEPLOY_BLOCK,
      toBlock: "latest",
      topics: [null, null, padToken, null],
    }]),
    botRpcCall("eth_getLogs", [{
      address: UNISWAP_V4_POOL_MANAGER,
      fromBlock: BOT_V4_DEPLOY_BLOCK,
      toBlock: "latest",
      topics: [null, null, null, padToken],
    }]),
  ]);
  const logs0 = Array.isArray(asCurrency0) ? asCurrency0 : [];
  const logs1 = Array.isArray(asCurrency1) ? asCurrency1 : [];
  return logs0.length > 0 || logs1.length > 0;
}

type BotDexResult = { version: "v3" | "v4" | null; isInDex: boolean };

async function botCheckDualDex(tokenAddress: string): Promise<BotDexResult> {
  if (!BOT_RPC_URL) return { version: null, isInDex: false };
  const [hasV3, hasV4] = await Promise.all([
    botCheckUniV3Pool(tokenAddress),
    botCheckUniV4Pool(tokenAddress),
  ]);
  if (hasV4) return { version: "v4", isInDex: true };
  if (hasV3) return { version: "v3", isInDex: true };
  return { version: null, isInDex: false };
}

function botDexLiveStatus(version: "v3" | "v4" | null): string | null {
  if (version === "v4") return "Live (Direct-to-V4) ✅";
  if (version === "v3") return "Live (Direct-to-V3) ✅";
  return null;
}

function botResolveVirtualsLabel(platformName: string, creatorAddress: string, lpHolders: any[]): string {
  if (platformName !== "Virtuals") return `${platformName} Managed ✅`;
  const cl = (creatorAddress || "").toLowerCase();
  if (cl === BOT_ERC8183_VAULT) return "Virtuals Managed (ERC-8183) 🤖";
  for (const lp of lpHolders) {
    if ((lp.address ?? "").toLowerCase() === BOT_ERC8183_VAULT) return "Virtuals Managed (ERC-8183) 🤖";
  }
  return "Virtuals Managed ✅";
}

function botGetPlatformName(creatorAddress: string, lpHolders: any[]): string | null {
  const cl = (creatorAddress || "").toLowerCase();
  if (BOT_PLATFORM_LOCKERS[cl]) return BOT_PLATFORM_LOCKERS[cl];
  if (BOT_PLATFORM_DEPLOYERS[cl]) return BOT_PLATFORM_DEPLOYERS[cl];
  for (const lp of lpHolders) {
    const a = (lp.address ?? "").toLowerCase();
    if (BOT_PLATFORM_LOCKERS[a]) return BOT_PLATFORM_LOCKERS[a];
    if (BOT_PLATFORM_DEPLOYERS[a]) return BOT_PLATFORM_DEPLOYERS[a];
  }
  return null;
}

// ─── RPC token info + holder helpers ─────────────────────────────────────────

function botDecodeString(hex: string): string {
  if (!hex || hex === "0x" || hex.length < 130) return "";
  try {
    const offsetVal = parseInt(hex.slice(2, 66), 16);
    const start = 2 + offsetVal * 2;
    const lenHex = hex.slice(start, start + 64);
    const len = parseInt(lenHex, 16);
    const strHex = hex.slice(start + 64, start + 64 + len * 2);
    const bytes = Buffer.from(strHex, "hex");
    return bytes.toString("utf8").replace(/\0/g, "");
  } catch { return ""; }
}

function botDecodeUint(hex: string): string {
  if (!hex || hex === "0x") return "0";
  try { return BigInt(hex).toString(); } catch { return "0"; }
}

async function botGetTokenInfo(address: string): Promise<{ name: string; symbol: string; totalSupply: string; decimals: number } | null> {
  if (!BOT_RPC_URL) return null;
  try {
    const [nameHex, symbolHex, supplyHex, decimalsHex] = await Promise.all([
      botRpcCall("eth_call", [{ to: address, data: "0x06fdde03" }, "latest"]),
      botRpcCall("eth_call", [{ to: address, data: "0x95d89b41" }, "latest"]),
      botRpcCall("eth_call", [{ to: address, data: "0x18160ddd" }, "latest"]),
      botRpcCall("eth_call", [{ to: address, data: "0x313ce567" }, "latest"]),
    ]);
    const name = botDecodeString(nameHex);
    const symbol = botDecodeString(symbolHex);
    if (!name && !symbol) return null;
    const totalSupply = botDecodeUint(supplyHex);
    const decimals = decimalsHex ? parseInt(decimalsHex, 16) : 18;
    return { name, symbol, totalSupply, decimals };
  } catch { return null; }
}

async function botFetchHolderCount(address: string): Promise<number | null> {
  try {
    const r = await fetch(
      `https://base.blockscout.com/api/v2/tokens/${encodeURIComponent(address)}/counters`,
      { signal: AbortSignal.timeout(6_000) },
    );
    if (!r.ok) return null;
    const data = await r.json() as any;
    const count = parseInt(data?.token_holders_count ?? "0");
    return count > 0 ? count : null;
  } catch { return null; }
}

async function botGetTopHolders(tokenAddress: string, decimals: number = 18): Promise<{ address: string; balance: string; percent: number }[]> {
  if (!BOT_RPC_URL) return [];
  try {
    const r = await fetch(
      `https://base.blockscout.com/api/v2/tokens/${encodeURIComponent(tokenAddress)}/holders?limit=5`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return [];
    const d = await r.json() as any;
    const items: any[] = d?.items ?? [];
    const supplyHex = await botRpcCall("eth_call", [{ to: tokenAddress, data: "0x18160ddd" }, "latest"]);
    const totalSupply = supplyHex ? BigInt(supplyHex) : BigInt(0);
    const validItems = items.slice(0, 5).filter((item: any) => !!item?.address?.hash);
    const balHexes = await Promise.all(
      validItems.map((item: any) => {
        const addr = item.address.hash;
        const padAddr = addr.replace("0x", "").padStart(64, "0");
        return botRpcCall("eth_call", [{ to: tokenAddress, data: `0x70a08231${padAddr}` }, "latest"]);
      })
    );
    const holders: { address: string; balance: string; percent: number }[] = [];
    for (let i = 0; i < validItems.length; i++) {
      const addr = validItems[i].address.hash;
      const bal = balHexes[i] ? BigInt(balHexes[i]) : BigInt(0);
      const pct = totalSupply > 0 ? Number((bal * BigInt(10000)) / totalSupply) / 100 : 0;
      const balStr = (Number(bal) / Math.pow(10, decimals)).toLocaleString("en-US", { maximumFractionDigits: 2 });
      holders.push({ address: addr, balance: balStr, percent: pct });
    }
    return holders;
  } catch { return []; }
}

// ─── Master timeout helper ───────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// ─── Police Snapshot Scanner ─────────────────────────────────────────────────

async function directGoPlus(address: string): Promise<any> {
  try {
    const addrLower = address.toLowerCase();

    let fastPlatform: string | null = BOT_PLATFORM_LOCKERS[addrLower] || BOT_PLATFORM_DEPLOYERS[addrLower] || null;
    let earlyDeployerBot = "";

    if (!fastPlatform) {
      try {
        const bsRes = await fetch(`https://base.blockscout.com/api/v2/addresses/${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(6000) });
        if (bsRes.ok) {
          const bsData = await bsRes.json() as any;
          earlyDeployerBot = (bsData?.creator_address_hash || "").toLowerCase();
          if (earlyDeployerBot) {
            fastPlatform = BOT_PLATFORM_DEPLOYERS[earlyDeployerBot] || BOT_PLATFORM_LOCKERS[earlyDeployerBot] || null;
            if (!fastPlatform) {
              try {
                const bs2 = await fetch(`https://base.blockscout.com/api/v2/addresses/${encodeURIComponent(earlyDeployerBot)}`, { signal: AbortSignal.timeout(5000) });
                if (bs2.ok) {
                  const d2 = await bs2.json() as any;
                  const deployer2 = (d2?.creator_address_hash || "").toLowerCase();
                  if (deployer2) fastPlatform = BOT_PLATFORM_DEPLOYERS[deployer2] || BOT_PLATFORM_LOCKERS[deployer2] || null;
                }
              } catch {}
            }
          }
        }
      } catch {}
    }

    if (!fastPlatform) {
      try {
        const thRes = await fetch(`https://base.blockscout.com/api/v2/tokens/${encodeURIComponent(address)}/holders?limit=10`, { signal: AbortSignal.timeout(5000) });
        if (thRes.ok) {
          const thData = await thRes.json() as any;
          const items: any[] = thData?.items ?? [];
          for (const item of items) {
            const ha = (item?.address?.hash || "").toLowerCase();
            if (BOT_PLATFORM_LOCKERS[ha]) { fastPlatform = BOT_PLATFORM_LOCKERS[ha]; break; }
            if (BOT_PLATFORM_DEPLOYERS[ha]) { fastPlatform = BOT_PLATFORM_DEPLOYERS[ha]; break; }
          }
          if (!fastPlatform) {
            const contractHolders = items.filter(i => i?.address?.is_contract).slice(0, 5);
            const hDeployers = await Promise.allSettled(
              contractHolders.map(i => {
                const ha = (i?.address?.hash || "").toLowerCase();
                return fetch(`https://base.blockscout.com/api/v2/addresses/${ha}`, { signal: AbortSignal.timeout(4000) })
                  .then(r => r.json()).then((d: any) => (d?.creator_address_hash || "").toLowerCase());
              })
            );
            for (const r of hDeployers) {
              if (r.status === "fulfilled" && r.value) {
                if (BOT_PLATFORM_DEPLOYERS[r.value]) { fastPlatform = BOT_PLATFORM_DEPLOYERS[r.value]; break; }
                if (BOT_PLATFORM_LOCKERS[r.value]) { fastPlatform = BOT_PLATFORM_LOCKERS[r.value]; break; }
              }
            }
          }
        }
      } catch {}
    }

    if (fastPlatform) {
      console.log(`[bot] WHITELIST HIT: ${address.slice(0,10)} → ${fastPlatform} — skipping GoPlus/Honeypot.is`);

      const [tokenInfo, dexResult, holderCountFb] = await Promise.all([
        botGetTokenInfo(address),
        botCheckDualDex(address),
        botFetchHolderCount(address),
      ]);
      const { version: dexVersion, isInDex: hasDexPool } = dexResult;

      let holderCount = holderCountFb || 0;
      let holderCountLabel: string;
      if (holderCount > 0) {
        holderCountLabel = holderCount.toLocaleString();
      } else {
        const BALANCE_SIG = "0x70a08231";
        const TOP_ADDRS = [
          "0x0000000000000000000000000000000000000001",
          addrLower,
          WETH_BASE,
          UNISWAP_V3_FACTORY,
          "0x4200000000000000000000000000000000000006",
        ];
        let hasActivity = false;
        for (const chkAddr of TOP_ADDRS) {
          const padAddr = chkAddr.replace("0x", "").toLowerCase().padStart(64, "0");
          const balHex = await botRpcCall("eth_call", [{ to: address, data: `${BALANCE_SIG}${padAddr}` }, "latest"]);
          if (balHex && balHex !== "0x" && balHex !== "0x" + "0".repeat(64)) {
            const bal = BigInt(balHex);
            if (bal > BigInt(0)) { hasActivity = true; break; }
          }
        }
        holderCountLabel = hasActivity ? "Scanning (High Activity)" : "Awaiting Indexer";
        console.log(`[bot] Blockscout 0 holders for ${address.slice(0,10)} — Alchemy balanceOf activity: ${hasActivity}`);
      }

      const liveStatus = botDexLiveStatus(dexVersion);
      const lpLabel = botResolveVirtualsLabel(fastPlatform, earlyDeployerBot || addrLower, []);

      return {
        riskLevel: "Clean",
        isKnownFactory: true,
        protocolSecured: true,
        holderCount,
        holderCountLabel,
        isOwnershipRenounced: true,
        isHoneypot: false,
        buyTax: 0,
        sellTax: 0,
        taxOverride: null,
        redFlags: [],
        adminThreats: [],
        tokenName: tokenInfo?.name || "Unknown",
        tokenSymbol: tokenInfo?.symbol || "???",
        lpEscrow: { name: fastPlatform, address: addrLower, percent: 100 },
        isHighRisk: false,
        isInDex: hasDexPool,
        platformName: fastPlatform,
        isWhitelistedFactory: true,
        liveStatus,
        lpStatus: lpLabel,
        dexVersion,
      };
    }

    const gpRes = await fetch(
      `https://api.gopluslabs.com/api/v1/token_security/8453?contract_addresses=${encodeURIComponent(address)}`,
      { signal: AbortSignal.timeout(15_000) }
    );
    if (!gpRes.ok) return null;
    const gpData = await gpRes.json() as any;
    const token = gpData?.result?.[address.toLowerCase()] ?? gpData?.result?.[Object.keys(gpData?.result || {})[0]] ?? null;
    if (!token) return null;

    const flagFn = (v: any) => v === "1" || v === 1 || v === true;
    const creatorLower = (token.creator_address || "").toLowerCase();
    const lpHolders: any[] = token.lp_holders ?? [];
    const platformName = botGetPlatformName(creatorLower, lpHolders);
    const isFactoryOrigin = !!platformName || ALL_BOT_FACTORY_ADDRESSES.has(creatorLower) || lpHolders.some((lp: any) => ALL_BOT_FACTORY_ADDRESSES.has((lp.address ?? "").toLowerCase()));

    let lpEscrowName: string | null = platformName;
    if (!lpEscrowName && isFactoryOrigin) lpEscrowName = "Protocol";

    let isHoneypot = flagFn(token.is_honeypot);
    if (platformName === "Virtuals" && isHoneypot) {
      isHoneypot = false;
      console.log(`[bot] Virtuals override: isHoneypot forced FALSE for ${address.slice(0,10)}`);
    }

    let buyTax = parseFloat(token.buy_tax ?? "0") * 100;
    let sellTax = parseFloat(token.sell_tax ?? "0") * 100;
    const isKnownFactory = !!lpEscrowName;

    let taxOverride: string | null = null;
    if (isKnownFactory && (buyTax > 50 || sellTax > 50)) {
      buyTax = 0;
      sellTax = 0;
      taxOverride = lpEscrowName;
    }

    let isInDex = flagFn(token.is_in_dex);
    let gpDexVersion: "v3" | "v4" | null = null;
    if (!isInDex) {
      const dexFb = await botCheckDualDex(address);
      if (dexFb.isInDex) {
        isInDex = true;
        gpDexVersion = dexFb.version;
        console.log(`[bot] Alchemy override: Uniswap ${dexFb.version?.toUpperCase()} pool confirmed for ${address.slice(0,10)}`);
      }
    }

    const redFlags: string[] = [];
    if (isHoneypot && !isKnownFactory) redFlags.push("Honeypot, cannot sell");
    if (buyTax > 10) redFlags.push(`High buy tax: ${buyTax.toFixed(1)}%`);
    if (sellTax > 10) redFlags.push(`High sell tax: ${sellTax.toFixed(1)}%`);
    if (!flagFn(token.is_open_source) && !isKnownFactory) redFlags.push("Contract not verified");
    if (flagFn(token.hidden_owner) && !isKnownFactory) redFlags.push("Hidden owner detected");

    let riskLevel: string;
    if (isKnownFactory) riskLevel = redFlags.length > 0 ? "Caution" : "Clean";
    else if ((isHoneypot || buyTax > 20 || sellTax > 20)) riskLevel = "High Risk";
    else if (redFlags.length >= 2) riskLevel = "High Risk";
    else if (redFlags.length >= 1) riskLevel = "Caution";
    else riskLevel = "Clean";

    const bsHolderCount = await botFetchHolderCount(address);
    let holderCount = bsHolderCount !== null && bsHolderCount > 0
      ? bsHolderCount
      : parseInt(token.holder_count ?? "0");

    return {
      riskLevel, isKnownFactory, protocolSecured: isKnownFactory, holderCount,
      isOwnershipRenounced: flagFn(token.is_in_dex),
      isHoneypot, buyTax, sellTax, taxOverride, redFlags, adminThreats: [],
      tokenName: token.token_name, tokenSymbol: token.token_symbol,
      lpEscrow: isKnownFactory ? { name: lpEscrowName, address: creatorLower, percent: 100 } : null,
      isHighRisk: riskLevel === "High Risk",
      isInDex,
      platformName,
      isWhitelistedFactory: isKnownFactory,
      liveStatus: isInDex ? botDexLiveStatus(gpDexVersion) : null,
      lpStatus: isKnownFactory
        ? botResolveVirtualsLabel(lpEscrowName || "Protocol", creatorLower, lpHolders)
        : null,
      dexVersion: gpDexVersion,
    };
  } catch (err: any) {
    console.error("[bot] directGoPlus fallback failed:", err?.message);
    return null;
  }
}

async function buildSnapshot(address: string, siteUrl: string): Promise<string> {
  try {
    const t0 = Date.now();

    const [apiResult, dexResult] = await Promise.allSettled([
      fetch(
        `http://localhost:5000/api/detective/analyze?address=${encodeURIComponent(address)}&chain=base`,
        { signal: AbortSignal.timeout(45_000) }
      ).then(r => r.ok ? r.json() : null),
      fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${address}`,
        { signal: AbortSignal.timeout(8_000) }
      ).then(r => r.json()),
    ]);
    console.log(`[bot-perf] internal API + DexScreener: ${Date.now() - t0}ms`);

    let api: any = apiResult.status === "fulfilled" ? apiResult.value : null;
    const dexData: any = dexResult.status === "fulfilled" ? dexResult.value : null;

    if (!api) {
      console.log(`[bot] Internal API returned null, using direct GoPlus fallback for ${address.slice(0,10)}`);
      api = await directGoPlus(address);
    }

    let allPairs: any[] = dexData?.pairs ?? [];
    let basePairs = allPairs
      .filter((p: any) => p.chainId === "base")
      .sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    if (basePairs.length === 0) {
      try {
        const searchQ = api?.tokenName || api?.tokenSymbol || "";
        if (searchQ) {
          const sRes = await fetch(
            `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(searchQ)}`,
            { signal: AbortSignal.timeout(6000) }
          );
          if (sRes.ok) {
            const sData = await sRes.json() as any;
            const sPairs: any[] = sData?.pairs ?? [];
            const matched = sPairs.filter((p: any) =>
              p.chainId === "base" &&
              (p.baseToken?.address?.toLowerCase() === address.toLowerCase() ||
               p.quoteToken?.address?.toLowerCase() === address.toLowerCase())
            );
            if (matched.length > 0) {
              basePairs = matched.sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
              console.log(`[bot] DexScreener search fallback found ${matched.length} pairs for ${searchQ}`);
            }
          }
        }
      } catch {}
    }

    const topPair = basePairs[0] ?? null;

    if (api?.addressType === "wallet") {
      const wFlags: string[] = api.walletFlags ?? [];
      const wRisk = api.riskLevel ?? "Clean";
      const wVerdict = api.apolVerdict ?? "No flags detected.";
      const flagsText = wFlags.length > 0 ? wFlags.map((f: string) => `• ${esc(f)}`).join("\n") : "• No flags detected on Base chain.";
      return (
        `🔍 *APOL AGENT — WALLET SCAN*\n\n` +
        `📍 Address: \`${address.slice(0,6)}...${address.slice(-4)}\`\n` +
        `🌐 Chain: Base Mainnet\n\n` +
        `RISK LEVEL: ${wRisk === "Clean" ? "🟢" : wRisk === "High Risk" ? "🔴" : "🟡"} *${esc(wRisk).toUpperCase()}*\n\n` +
        `${flagsText}\n\n` +
        `${esc(wVerdict)}`
      );
    }

    if (!api && !topPair) {
      return (
        `⚠️ *INVESTIGATION STALLED*\n\n` +
        `Contract not found on Base Mainnet. Ensure the CA is correct.\n\n` +
        `\`${address}\``
      );
    }

    const tokenName   = esc(api?.tokenName   ?? topPair?.baseToken?.name   ?? "Unknown");
    const tokenSymbol = `$${esc(api?.tokenSymbol ?? topPair?.baseToken?.symbol ?? "?")}`;

    const apolSelfNames = ["apol", "apol agent", "active onchain intelligence", "$apol"];
    if (apolSelfNames.includes(tokenName.toLowerCase().trim()) || apolSelfNames.includes((api?.tokenSymbol ?? "").toLowerCase().trim())) {
      return (
        `🚨 *⚠️ SCAM ALERT*\n\n` +
        `Token: *${tokenName}* (${tokenSymbol})\n` +
        `Address: \`${address}\`\n\n` +
        `APOL does NOT have any contract address.\n` +
        `Any token using the APOL name is a *SCAM*.\n\n` +
        `Official Twitter: @ApolAgent\\_\n\n` +
        `Risk Level: 🔴 *HIGH*\n` +
        `Do NOT interact with this contract. 🚨`
      );
    }

    const holderCount = api?.holderCountLabel
      ? (parseInt(api.holderCountLabel) > 0 ? parseInt(api.holderCountLabel).toLocaleString() : api.holderCountLabel)
      : (api?.holderCount && api.holderCount > 0) ? api.holderCount.toLocaleString() : "Scanning (High Activity)";
    const isProtocolTax = !!api?.taxOverride;
    const buyTaxFmt  = isProtocolTax ? `0.0%` : (api ? `${(api.buyTax ?? 0).toFixed(1)}%` : "Data Pending");
    const sellTaxFmt = isProtocolTax ? `0.0%` : (api ? `${(api.sellTax ?? 0).toFixed(1)}%` : "Data Pending");

    const hasDex = !!topPair;
    const isInDex = !!api?.isInDex;
    const isKnownFactory = !!api?.isKnownFactory;
    const lpEscrowName   = api?.lpEscrow?.name ?? null;

    const liqUsd: number | null = topPair?.liquidity?.usd ?? null;
    const liqFormatted = liqUsd !== null ? fmtUsd(liqUsd) : (hasDex ? "Data Pending" : (isKnownFactory ? "Platform Managed" : "Data Pending"));
    const priceRaw  = parseFloat(topPair?.priceUsd ?? "0");
    const priceStr  = priceRaw > 0 ? fmtPrice(priceRaw) : (hasDex ? "Data Pending" : (isKnownFactory ? "Indexing..." : "Data Pending"));
    const fdvRaw    = topPair?.fdv ?? null;
    const mcapStr   = fdvRaw ? fmtUsd(fdvRaw) : (hasDex ? "Data Pending" : (isKnownFactory ? "Indexing..." : "Data Pending"));

    const isProtocolEscrow = !!api?.protocolSecured;
    const isOwnershipRenounced = !!api?.isOwnershipRenounced;
    const redFlags: string[] = api?.redFlags ?? [];
    const adminThreats: any[] = api?.adminThreats ?? [];

    const liveStatus: string | null = api?.liveStatus || (isInDex ? botDexLiveStatus(api?.dexVersion || null) : null);

    let lpStatus: string;
    if (api?.lpStatus)                  lpStatus = esc(api.lpStatus);
    else if (isKnownFactory && lpEscrowName) lpStatus = `${esc(lpEscrowName)} Managed ✅`;
    else if (isProtocolEscrow)          lpStatus = `Protocol Managed ✅`;
    else if (api?.riskLevel)            lpStatus = redFlags.some(f => f.toLowerCase().includes("lp not locked")) ? `Unlocked ⚠️` : `Secured ✅`;
    else                                lpStatus = `Data Pending`;

    const flags: string[] = [];
    const adminAlerts: string[] = [];
    if (api) {
      for (const rf of redFlags) {
        const srf = esc(rf);
        if (rf.includes("buy tax"))       flags.push(`💸 ${srf}`);
        else if (rf.includes("sell tax")) flags.push(`💸 ${srf}`);
        else if (rf.toLowerCase().includes("honeypot")) flags.push(`⛔ ${srf}`);
        else if (rf.includes("mint"))      flags.push(`🖨️ ${srf}`);
        else if (rf.includes("blacklist")) flags.push(`🚫 ${srf}`);
        else if (rf.includes("proxy"))     flags.push(`🔄 ${srf}`);
        else if (rf.includes("LP not"))    flags.push(`🔓 ${srf}`);
        else if (rf.includes("holder"))    flags.push(`👥 ${srf}`);
        else if (rf.includes("verified"))  flags.push(`👁️ ${srf}`);
        else flags.push(`⚠️ ${srf}`);
      }
      for (const at of adminThreats) {
        adminAlerts.push(`🔑 ${esc(at.label)} — ${esc(at.detail.split(".")[0])}`);
      }
      if (liqUsd !== null && liqUsd < 5000 && !flags.some(f => f.includes("Liquidity"))) {
        flags.push("💧 Very Low Liquidity");
      }
    }

    let riskEmoji: string;
    const rl = (api?.riskLevel ?? "").toLowerCase();
    if (rl === "high risk")                          riskEmoji = "🔴 HIGH RISK";
    else if (rl === "caution")                       riskEmoji = "🟡 MEDIUM RISK";
    else if (rl === "clean" || rl === "safe")         riskEmoji = "🟢 LOW RISK";
    else                                              riskEmoji = flags.length > 0 ? "🟡 MEDIUM RISK" : "🟢 LOW RISK";

    let msg = "";
    msg += `🚔 *APOL AGENT — CONTRACT SNAPSHOT*\n\n`;
    msg += `📍 *Address:* \`${shortAddr(address)}\`\n`;
    msg += `⛓️ *Chain:* Base Mainnet\n\n`;

    const lookupCount = api?.lookupCount ?? 0;
    msg += `*${tokenName}* (${tokenSymbol}) 👁️ ${lookupCount}\n`;
    msg += `💲 Price: *${priceStr}*\n`;
    msg += `📊 Market Cap: *${mcapStr}*\n`;
    msg += `💧 Liquidity: *${liqFormatted}*\n`;
    if (liveStatus) msg += `📡 Status: *${liveStatus}*\n`;
    msg += `🔒 LP Status: *${lpStatus}*\n`;
    msg += `👥 Holders: *${holderCount}*\n`;
    msg += `💰 Buy Tax: *${buyTaxFmt}*  |  Sell Tax: *${sellTaxFmt}*\n`;

    msg += `\n*RISK LEVEL: ${riskEmoji}*\n`;

    const isHighRisk = rl === "high risk";
    if (isOwnershipRenounced && adminAlerts.length === 0 && !isHighRisk) {
      msg += `\n✅ *CONTRACT RENOUNCED*\n`;
      msg += `• Ownership burned. No admin keys.\n`;
    }

    if (adminAlerts.length > 0) {
      msg += `\n🔑 *ADMIN PERMISSIONS — LIVE THREAT:*\n`;
      msg += `_Past audits do not clear active permissions._\n`;
      adminAlerts.forEach(a => (msg += `  ${a}\n`));
    }

    if (flags.length > 0) {
      msg += `\n🚩 *FLAGS DETECTED:*\n`;
      flags.slice(0, 8).forEach(f => (msg += `  ${f}\n`));
      if (flags.length > 8) msg += `  _(+${flags.length - 8} more)_\n`;
    } else if (adminAlerts.length === 0) {
      msg += `\n✅ *No flags detected on Base chain.*\n`;
    }

    msg += `\n🔍 [Full Scan](${siteUrl}/agent-scanner)   `;
    msg += `🗺️ [Wall of Shame](${siteUrl}/report-scam)\n`;
    msg += `🔗 [View on Basescan](https://basescan.org/address/${address})`;

    console.log(`[bot-perf] buildSnapshot TOTAL: ${Date.now() - t0}ms for ${address.slice(0,10)}`);
    return msg;

  } catch (err: any) {
    console.error("[APOL Bot] Scan error:", err?.message ?? err);
    return (
      `❌ *Scan Failed*\n\n` +
      `Could not reach the security database. Please try again in a moment.\n` +
      `If the problem persists, try the full scanner at [${siteUrl}](${siteUrl}/agent-scanner).`
    );
  }
}

// ─── Wallet Investigation ─────────────────────────────────────────────────────

// GoPlus address_security field → human-readable label mapping
const WALLET_FLAGS: Record<string, string> = {
  blacklist_doubt:             "🔴 Blacklist Suspect",
  honeypot_related_address:    "⛔ Scam / Honeypot Affiliated",
  sanctioned:                  "⚠️ Sanctioned (Legal Risk)",
  phishing_activities:         "🎣 Phishing History",
  stealing_attack:             "🦹 Theft / Stealing",
  cybercrime:                  "💻 Cybercrime",
  money_laundering:            "💰 Money Laundering",
  financial_crime:             "🏦 Financial Crime",
  darkweb_transactions:        "🕸️ Dark Web Activity",
  blackmail_activities:        "🚨 Blackmail",
  malicious_mining_activities: "⛏️ Malicious Mining",
  mixer:                       "🌀 Mixer / Tumbler Usage",
  fake_kyc:                    "📋 Fake KYC",
  gas_abuse:                   "⛽ Gas Abuse",
  reinit:                      "🔄 Reinit Attack",
};

// Known funding source labels keyed by partial address match or name
const KNOWN_SOURCES: Array<{ match: string; label: string }> = [
  { match: "0xd3a5b", label: "Binance (CEX)" },
  { match: "0x3f5ce", label: "Binance (CEX)" },
  { match: "0x28c6c0", label: "Binance (CEX)" },
  { match: "0xa9d1e", label: "Binance (CEX)" },
  { match: "0x564286", label: "Binance (CEX)" },
  { match: "0xa910f9", label: "Coinbase (CEX)" },
  { match: "0x503828", label: "Coinbase (CEX)" },
  { match: "0x71660c", label: "Coinbase (CEX)" },
  { match: "0x77696c", label: "Coinbase (CEX)" },
  { match: "0xd68a82", label: "Coinbase (CEX)" },
  { match: "0x66f820", label: "Kraken (CEX)" },
  { match: "0x2910d8", label: "Kraken (CEX)" },
  { match: "0x0a869d", label: "OKX (CEX)" },
  { match: "0x98ec05", label: "OKX (CEX)" },
  { match: "0xd882cf", label: "Huobi (CEX)" },
  { match: "0xadb2b4", label: "Tornado Cash (Mixer)" },
  { match: "0x910cbd", label: "Tornado Cash (Mixer)" },
  { match: "0x12d66f", label: "Tornado Cash (Mixer)" },
  { match: "0x47ce0c", label: "Tornado Cash (Mixer)" },
  { match: "0x23773e", label: "Tornado Cash (Mixer)" },
  { match: "0x4736dc", label: "FixedFloat (Mixer/Swap)" },
  { match: "0xba5ede", label: "Stargate Bridge" },
  { match: "0x4200000000000000000000000000000000000010", label: "Base Bridge (Official)" },
  { match: "0x49048044d57e1c92a77f79988d21fa8faf74e97", label: "Base Bridge (Official)" },
  { match: "0x8498b2", label: "Base Bridge (Official)" },
  { match: "0x99c9fc", label: "Optimism Bridge" },
];

function identifySource(fromAddr: string): string {
  const lower = fromAddr.toLowerCase();
  for (const { match, label } of KNOWN_SOURCES) {
    if (lower.startsWith(match.toLowerCase())) return label;
  }
  return `Unknown (${shortAddr(fromAddr)})`;
}

function fmtAge(isoTs: string): { days: number; label: string } | null {
  const d = new Date(isoTs);
  if (isNaN(d.getTime())) return null;
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  let label: string;
  if (days < 1)       label = "< 1 day";
  else if (days < 30) label = `${days} days`;
  else {
    const months = Math.floor(days / 30);
    const years  = Math.floor(months / 12);
    const rem    = months % 12;
    label = years > 0
      ? (rem > 0 ? `~${years}y ${rem}m` : `~${years} year${years > 1 ? "s" : ""}`)
      : `~${months} month${months > 1 ? "s" : ""}`;
  }
  return { days, label };
}

async function fetchOldestTx(address: string): Promise<{ timestamp: string; from: string } | null> {
  const BLOCKSCOUT = "https://base.blockscout.com/api/v2";
  const sig = AbortSignal.timeout(8_000);

  // Paginate through transactions (50 per page) up to 5 pages to find oldest
  let nextParams: Record<string, string> | null = null;
  let lastItem: any = null;

  for (let page = 0; page < 5; page++) {
    let url = `${BLOCKSCOUT}/addresses/${encodeURIComponent(address)}/transactions`;
    if (nextParams) {
      const qs = new URLSearchParams(nextParams).toString();
      url += `?${qs}`;
    }
    try {
      const res = await fetch(url, { signal: sig });
      const data = (await res.json()) as any;
      const items: any[] = data?.items ?? [];
      if (items.length > 0) lastItem = items[items.length - 1];
      if (!data?.next_page_params) break;
      nextParams = data.next_page_params;
    } catch {
      break;
    }
  }

  if (!lastItem) return null;
  return {
    timestamp: lastItem.timestamp,
    from: lastItem.from?.hash ?? "",
  };
}

// Chain explorer base URLs (for genesis TX links across all chains)
function chainExplorer(chainId: string): { name: string; txUrl: string; addrUrl: string } {
  switch (chainId) {
    case "0x1":    return { name: "Ethereum",  txUrl: "https://etherscan.io/tx/",    addrUrl: "https://etherscan.io/address/" };
    case "0x2105": return { name: "Base",      txUrl: "https://basescan.org/tx/",    addrUrl: "https://basescan.org/address/" };
    case "0x89":   return { name: "Polygon",   txUrl: "https://polygonscan.com/tx/", addrUrl: "https://polygonscan.com/address/" };
    case "0x38":   return { name: "BSC",       txUrl: "https://bscscan.com/tx/",     addrUrl: "https://bscscan.com/address/" };
    case "0xa":    return { name: "Optimism",  txUrl: "https://optimistic.etherscan.io/tx/", addrUrl: "https://optimistic.etherscan.io/address/" };
    case "0xa4b1": return { name: "Arbitrum",  txUrl: "https://arbiscan.io/tx/",     addrUrl: "https://arbiscan.io/address/" };
    default:       return { name: "Chain "+chainId, txUrl: "https://basescan.org/tx/", addrUrl: "https://basescan.org/address/" };
  }
}

// Known bridge address fragments for fallback classification
const BRIDGE_ADDRESSES: Array<{ match: string; name: string }> = [
  { match: "0x4200000000000000000000000000000000000010", name: "Base Bridge" },
  { match: "0x49048044d57e1c92a77f79988d21fa8faf74e97",  name: "Base Bridge" },
  { match: "0xba5ede",  name: "Stargate Bridge" },
  { match: "0x99c9fc",  name: "Optimism Bridge" },
  { match: "0x8b0a4",  name: "Across Protocol" },
  { match: "0x5523f2fc", name: "Orbiter Finance" },
  { match: "0xe4edb2", name: "Orbiter Finance" },
  { match: "0xd9d16a", name: "Synapse Bridge" },
  { match: "0x1116898", name: "Hop Protocol" },
];

function classifyFundingSource(fromAddr: string, moralisLabel: string | null, moralisEntity: string | null): {
  display: string;
  risk: "low" | "medium" | "high" | "unknown";
} {
  const label = moralisLabel ?? moralisEntity ?? "";

  if (label) {
    const low = label.toLowerCase();
    if (low.includes("binance") || low.includes("coinbase") || low.includes("kraken") ||
        low.includes("okx") || low.includes("huobi") || low.includes("bybit") ||
        low.includes("kucoin") || low.includes("gemini") || low.includes("crypto.com")) {
      return { display: `🏦 FUNDED BY: ${label}`, risk: "low" };
    }
    if (low.includes("tornado") || low.includes("mixer") || low.includes("tumbler") ||
        low.includes("fixedfloat") || low.includes("blender") || low.includes("wasabi")) {
      return { display: `⛔ FUNDED BY: ${label} (Mixer)`, risk: "high" };
    }
    if (low.includes("bridge") || low.includes("stargate") || low.includes("across") ||
        low.includes("hop") || low.includes("synapse") || low.includes("orbiter") ||
        low.includes("celer") || low.includes("relay")) {
      return { display: `🌉 FUNDED VIA: ${label}`, risk: "medium" };
    }
    // Named entity but not CEX/mixer/bridge
    return { display: `🏦 FUNDED BY: ${label}`, risk: "unknown" };
  }

  // No label — check our bridge fragment list
  const addrLow = fromAddr.toLowerCase();
  for (const { match, name } of BRIDGE_ADDRESSES) {
    if (addrLow.startsWith(match.toLowerCase()) || addrLow === match.toLowerCase()) {
      return { display: `🌉 FUNDED VIA: ${name}`, risk: "medium" };
    }
  }

  // Check our existing CEX/bridge table
  const known = identifySource(fromAddr);
  if (!known.startsWith("Unknown")) {
    const low = known.toLowerCase();
    if (low.includes("cex") || low.includes("coinbase") || low.includes("binance") ||
        low.includes("kraken") || low.includes("okx")) {
      return { display: `🏦 FUNDED BY: ${known.replace(" (CEX)", "")}`, risk: "low" };
    }
    if (low.includes("mixer") || low.includes("tornado")) {
      return { display: `⛔ FUNDED VIA: ${known} (Mixer)`, risk: "high" };
    }
    if (low.includes("bridge")) {
      return { display: `🌉 FUNDED VIA: ${known}`, risk: "medium" };
    }
  }

  return { display: `⚠️ Unknown/Bridge`, risk: "unknown" };
}

async function buildWalletCheck(address: string): Promise<string> {
  try {
    const MORALIS_KEY = process.env.MORALIS_API_KEY ?? "";
    const MORALIS     = "https://deep-index.moralis.io/api/v2";
    const mHdrs       = { "X-API-Key": MORALIS_KEY };

    if (!MORALIS_KEY) {
      return `❌ *Configuration Error*\n\nMORALIS_API_KEY is not set. Contact the bot administrator.`;
    }

    const encodedAddr = encodeURIComponent(address);
    const addrLow = address.toLowerCase();

    const moralisTxP = fetch(`${MORALIS}/${encodedAddr}?chain=0x2105&order=ASC&limit=100`,
      { headers: mHdrs, signal: AbortSignal.timeout(7_000) })
      .then(r => r.json())
      .then((d: any) => {
        const txs = d?.result ?? [];
        if (txs.length === 0) throw new Error("moralis-empty");
        return { source: "moralis" as const, data: d, txs };
      });

    const blockscoutTxP = fetch(
      `https://base.blockscout.com/api/v2/addresses/${encodedAddr}/transactions?sort=asc&filter=to%7Cfrom`,
      { signal: AbortSignal.timeout(7_000) })
      .then(r => r.json())
      .then((d: any) => {
        const items: any[] = Array.isArray(d?.items) ? d.items : [];
        if (items.length === 0) throw new Error("blockscout-empty");
        const txs = items.map((tx: any) => ({
          hash: tx.hash,
          from_address: tx.from?.hash ?? null,
          to_address: tx.to?.hash ?? null,
          value: tx.value ?? "0",
          block_timestamp: tx.timestamp ?? null,
        }));
        return { source: "blockscout" as const, data: d, txs };
      });

    const txHistoryP = Promise.any([moralisTxP, blockscoutTxP]).catch(() => null);

    const [baseChainsR, allChainsR, threatR, bsAddrR, alchemyBalR, txHistoryR] = await Promise.allSettled([
      fetch(`${MORALIS}/wallets/${encodedAddr}/chains?chains[]=base`,
        { headers: mHdrs, signal: AbortSignal.timeout(6_000) }).then(r => r.json()),
      fetch(`${MORALIS}/wallets/${encodedAddr}/chains`,
        { headers: mHdrs, signal: AbortSignal.timeout(6_000) }).then(r => r.json()),
      fetch(`${GOPLUS_BASE}/address_security/${encodedAddr}?chain_id=${BASE_CHAIN_ID}`,
        { signal: AbortSignal.timeout(6_000) }).then(r => r.json()),
      fetch(`https://base.blockscout.com/api/v2/addresses/${encodedAddr}`,
        { signal: AbortSignal.timeout(6_000) }).then(r => r.json()),
      BOT_RPC_URL
        ? botRpcCall("eth_getBalance", [address, "latest"])
        : Promise.resolve(null),
      txHistoryP,
    ]);

    const baseChainsData = baseChainsR.status === "fulfilled" ? baseChainsR.value : {};
    const allChainsData  = allChainsR.status === "fulfilled" ? allChainsR.value : {};
    const threatData     = threatR.status === "fulfilled" ? threatR.value : {};
    const bsAddr         = bsAddrR.status === "fulfilled" ? bsAddrR.value : {};
    const gpResult       = threatData?.result ?? null;

    const alchemyBalHex = alchemyBalR.status === "fulfilled" ? alchemyBalR.value : null;
    let alchemyBalEth: number | null = null;
    if (alchemyBalHex && typeof alchemyBalHex === "string" && alchemyBalHex.startsWith("0x")) {
      try { alchemyBalEth = Number(BigInt(alchemyBalHex)) / 1e18; } catch {}
    }

    const txResult = txHistoryR.status === "fulfilled" ? txHistoryR.value : null;
    let baseTxs: any[] = txResult?.txs ?? [];
    let txSource = txResult?.source ?? "none";
    let baseTxData: any = txResult?.data ?? {};

    const baseChainEntry = (baseChainsData?.active_chains ?? [])
      .find((c: any) => c.chain === "base" || c.chain_id === "0x2105");
    let genesisTxHash    = baseChainEntry?.first_transaction?.transaction_hash ?? null;
    let genesisTimestamp = baseChainEntry?.first_transaction?.block_timestamp ?? null;

    if (!genesisTxHash && baseTxs.length > 0) {
      genesisTxHash    = baseTxs[0].hash;
      genesisTimestamp = baseTxs[0].block_timestamp;
    }

    if (!genesisTimestamp) {
      try {
        const bsRes = await fetch(
          `https://base.blockscout.com/api/v2/addresses/${encodedAddr}/transactions?sort=asc`,
          { signal: AbortSignal.timeout(4_000) }
        );
        const bsData = await bsRes.json() as any;
        const oldest = (bsData?.items ?? [])[0];
        if (oldest?.timestamp) genesisTimestamp = oldest.timestamp;
      } catch { /* non-fatal */ }
    }

    const firstIncoming = baseTxs.find(
      (tx: any) => (tx.to_address ?? "").toLowerCase() === addrLow
    );
    let funderTxHash  = firstIncoming?.hash ?? null;
    let funderAddr    = firstIncoming?.from_address ?? null;
    let funderTs      = firstIncoming?.block_timestamp ?? null;

    if (!funderAddr && genesisTxHash) {
      try {
        const txRes = await fetch(
          `${MORALIS}/transaction/${encodeURIComponent(genesisTxHash)}?chain=0x2105`,
          { headers: mHdrs, signal: AbortSignal.timeout(4_000) }
        );
        if (txRes.ok) {
          const txData = await txRes.json() as any;
          if ((txData?.to_address ?? "").toLowerCase() === addrLow) {
            funderAddr  = txData.from_address;
            funderTxHash = genesisTxHash;
            funderTs     = txData.block_timestamp ?? genesisTimestamp;
          }
        }
      } catch { /* non-fatal */ }
    }

    let moralisLabel: string | null = null;
    let moralisEntity: string | null = null;
    let funderEns: string | null = null;

    if (funderAddr) {
      const [labelR, ensR] = await Promise.allSettled([
        funderTxHash
          ? fetch(`${MORALIS}/transaction/${encodeURIComponent(funderTxHash)}?chain=0x2105`,
              { headers: mHdrs, signal: AbortSignal.timeout(4_000) }).then(r => r.json())
          : Promise.resolve(null),
        fetch(`https://base.blockscout.com/api/v2/addresses/${encodeURIComponent(funderAddr)}`,
          { signal: AbortSignal.timeout(4_000) }).then(r => r.json()),
      ]);

      if (labelR.status === "fulfilled" && labelR.value) {
        moralisLabel  = labelR.value.from_address_label  ?? null;
        moralisEntity = labelR.value.from_address_entity ?? null;
      }
      if (ensR.status === "fulfilled" && ensR.value) {
        funderEns = ensR.value?.ens_domain_name ?? null;
      }
    }

    const funderDisplayName = funderEns || moralisLabel || moralisEntity || null;
    const { display: fundingDisplay, risk: fundingRisk } = funderAddr
      ? (funderDisplayName
          ? classifyFundingSource(funderAddr, funderDisplayName, moralisEntity)
          : classifyFundingSource(funderAddr, moralisLabel, moralisEntity))
      : { display: "⚠️ Unknown", risk: "unknown" as const };

    const finalFundingDisplay = (funderEns && fundingDisplay.includes("Unknown"))
      ? `🏦 FUNDED BY: ${funderEns}`
      : fundingDisplay;

    let firstSeenDate  = "ERROR: API TIMEOUT";
    let walletAgeDays  = "ERROR: API TIMEOUT";
    let walletAgeLabel = "ERROR: API TIMEOUT";

    if (genesisTimestamp) {
      const ageResult = fmtAge(genesisTimestamp);
      if (ageResult) {
        const createdAt = new Date(genesisTimestamp);
        firstSeenDate  = createdAt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        walletAgeDays  = `${ageResult.days.toLocaleString()} days`;
        walletAgeLabel = ageResult.label;
      }
    }

    const hasMoreBase = txSource === "moralis"
      ? !!baseTxData?.cursor
      : (txSource === "blockscout" && baseTxData?.next_page_params != null);
    const baseTxCount     = baseTxs.length;
    const anyTxSourceLoaded = txResult !== null;

    let inf  = BigInt(0);
    let outf = BigInt(0);
    for (const tx of baseTxs) {
      const val = BigInt(tx.value ?? "0");
      if ((tx.to_address   ?? "").toLowerCase() === addrLow) inf  += val;
      if ((tx.from_address ?? "").toLowerCase() === addrLow) outf += val;
    }
    const inflowEth  = inf  > 0n ? (Number(inf)  / 1e18) : null;
    const outflowEth = outf > 0n ? (Number(outf) / 1e18) : null;

    let txCountDisplay: string;
    let activityLevel: string;
    if (!anyTxSourceLoaded) {
      txCountDisplay = "History Loading...";
      activityLevel  = "History Loading...";
    } else if (baseTxCount === 0) {
      txCountDisplay = "No Base activity found";
      activityLevel  = "No Base activity";
    } else {
      txCountDisplay = hasMoreBase ? `${baseTxCount}+ txs` : `${baseTxCount} txs`;
      if (baseTxCount > 50)       activityLevel = "High (Established Wallet)";
      else if (baseTxCount >= 10) activityLevel = "Moderate";
      else                        activityLevel = "⚠️ Low — Fresh Profile";
    }

    const isContract   = bsAddr?.is_contract ?? false;

    const coinBalance = alchemyBalEth !== null
      ? alchemyBalEth
      : (bsAddr?.coin_balance ? parseFloat(bsAddr.coin_balance) / 1e18 : null);
    const exchangeRate = bsAddr?.exchange_rate ? parseFloat(bsAddr.exchange_rate) : null;
    const ethBal       = coinBalance !== null ? `${coinBalance.toFixed(4)} ETH` : "N/A";
    const usdBal       = coinBalance !== null && exchangeRate
      ? ` (≈${fmtUsd(coinBalance * exchangeRate)})` : "";

    // ── Step 8: APOL AGENT threat intelligence flags ──────────────────────────
    const activeFlags: string[] = [];
    if (gpResult) {
      for (const [field, label] of Object.entries(WALLET_FLAGS)) {
        if (flag(gpResult[field])) activeFlags.push(label as string);
      }
    }

    const isCritical   = gpResult && (flag(gpResult.blacklist_doubt) || flag(gpResult.sanctioned));
    const isSuspicious = activeFlags.length > 0 || fundingRisk === "high";

    let status: string;
    if (isCritical)        status = "🔴 BLACKLISTED";
    else if (isSuspicious) status = "⚠️ SUSPICIOUS";
    else                   status = "✅ CLEAN";

    // ── Step 9: Verdict ───────────────────────────────────────────────────────
    let verdict: string;
    if (flag(gpResult?.sanctioned)) {
      verdict = "This wallet is under legal sanction. Any interaction may carry regulatory consequences.";
    } else if (flag(gpResult?.blacklist_doubt)) {
      verdict = "Flagged for malicious activity. Do not interact.";
    } else if (flag(gpResult?.honeypot_related_address)) {
      verdict = "Affiliated with honeypot contracts. Treat as hostile.";
    } else if (flag(gpResult?.phishing_activities)) {
      verdict = "Phishing activity on record. This wallet has drained others.";
    } else if (flag(gpResult?.stealing_attack)) {
      verdict = "Linked to theft attacks. Do not send funds.";
    } else if (flag(gpResult?.money_laundering) || flag(gpResult?.financial_crime)) {
      verdict = "Financial crime indicators present. Exercise extreme caution.";
    } else if (activeFlags.length > 0) {
      verdict = "Suspicious activity detected. Investigate further before interacting.";
    } else if (fundingRisk === "high") {
      verdict = "Genesis funding from a mixer — high-probability sybil or rug profile.";
    } else if (baseTxCount > 0 && baseTxCount < 5) {
      verdict = "Fresh wallet with minimal history. Insufficient data to confirm legitimacy.";
    } else if (baseTxCount === 0 && !genesisTimestamp) {
      verdict = "No on-chain activity found on Base. Wallet has not been used.";
    } else {
      verdict = "No malicious activity detected. Wallet appears clean.";
    }

    // ── Step 10: Build the report ─────────────────────────────────────────────
    const baseExplorer = chainExplorer("0x2105");
    const genesisTxLink = genesisTxHash
      ? `[${genesisTxHash.slice(0, 10)}...${genesisTxHash.slice(-6)}](${baseExplorer.txUrl}${genesisTxHash})`
      : "N/A";

    let msg = "";
    msg += `🔬 *APOL AGENT — WALLET FORENSICS*\n\n`;
    msg += `👤 *Address:* \`${shortAddr(address)}\`\n`;
    msg += `🏷️ *Type:* ${isContract ? "Smart Contract" : "EOA (Wallet)"}\n`;
    msg += `🚨 *Status:* ${status}\n\n`;

    msg += `📅 *GENESIS (First Base Transaction)*\n`;
    msg += `Date: ${firstSeenDate}\n`;
    msg += `Age: ${walletAgeDays} (${walletAgeLabel})\n`;
    msg += `Chain: BASE\n`;
    msg += `Hash: ${genesisTxLink}\n\n`;

    msg += `💰 *FUNDING SOURCE (Base)*\n`;
    msg += `${esc(finalFundingDisplay)}\n`;
    if (funderAddr) msg += `From: \`${shortAddr(funderAddr)}\`\n`;
    msg += `\n`;

    msg += `📊 *ACTIVITY (Base Mainnet)*\n`;
    msg += `Transactions: ${txCountDisplay}\n`;
    msg += `Level: ${activityLevel}\n`;
    const infStr  = inflowEth  !== null ? `${inflowEth.toFixed(4)} ETH`  : "N/A";
    const outfStr = outflowEth !== null ? `${outflowEth.toFixed(4)} ETH` : "N/A";
    msg += `Inflow: ${infStr}   Outflow: ${outfStr}\n\n`;

    msg += `💼 *CURRENT BALANCE*\n`;
    msg += `${ethBal}${usdBal}\n\n`;

    if (activeFlags.length > 0) {
      msg += `🚩 *THREAT INTEL:*\n`;
      activeFlags.forEach(f => (msg += `  ${f}\n`));
      msg += `\n`;
    } else {
      msg += `✅ *No threat flags on record.*\n\n`;
    }

    msg += `🛡️ *VERDICT:* _${esc(verdict)}_\n\n`;
    msg += `🔗 [View on Basescan](https://basescan.org/address/${address})`;

    return msg;

  } catch (err: any) {
    console.error("[APOL Bot] Wallet forensic error:", err?.message ?? err);
    return `❌ *Forensic Report Failed*\n\nCould not reach intelligence database. Please try again in a moment.`;
  }
}

// ─── Agent Intelligence Scan ─────────────────────────────────────────────────

async function resolveAgentAddress(input: string): Promise<{ address: string; name: string; symbol: string } | null> {
  // If it's already a valid address, return it directly
  if (isEvmAddress(input)) {
    return { address: input, name: "", symbol: "" };
  }

  // Search DexScreener by name/ticker, pick best Base chain match by liquidity
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(input)}`,
      { signal: AbortSignal.timeout(6_000) }
    );
    const data = (await res.json()) as any;
    const pairs: any[] = data?.pairs ?? [];
    const base = pairs
      .filter((p: any) => p.chainId === "base")
      .sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    if (!base[0]) return null;
    return {
      address: base[0].baseToken.address,
      name:    base[0].baseToken.name,
      symbol:  base[0].baseToken.symbol,
    };
  } catch {
    return null;
  }
}

async function buildAgentScan(input: string, siteUrl: string): Promise<string> {
  try {
    const apolSelfNames = ["apol", "apol agent", "active onchain intelligence", "$apol"];
    if (apolSelfNames.includes(input.toLowerCase().trim())) {
      return (
        `🦍 *APOL AGENT — NOTICE*\n\n` +
        `*The Sentinel is Active. Intelligence verified.*\n\n` +
        `Agent: *APOL Agent*\n` +
        `Classification: *AUTHORITY* 🔐\n\n` +
        `APOL does *NOT* have any contract address at this time.\n` +
        `Any token using the APOL name is a *SCAM*.\n\n` +
        `Official Twitter: @ApolAgent\\_\n` +
        `Trust the protocol. 🦍✅`
      );
    }

    // ── Resolve address (accept name or CA) ───────────────────────────────────
    const resolved = await resolveAgentAddress(input);
    if (!resolved) {
      return (
        `⚠️ *AGENT NOT FOUND*\n\n` +
        `No agent matching "${esc(input)}" found on Base Mainnet.\n` +
        `Try using the contract address directly.`
      );
    }
    const { address } = resolved;

    let agentFastPlatform: string | null = BOT_PLATFORM_LOCKERS[address.toLowerCase()] || BOT_PLATFORM_DEPLOYERS[address.toLowerCase()] || null;
    if (!agentFastPlatform) {
      try {
        const bsRes = await fetch(`https://base.blockscout.com/api/v2/addresses/${encodeURIComponent(address)}`, { signal: AbortSignal.timeout(6000) });
        if (bsRes.ok) {
          const bsData = await bsRes.json() as any;
          const deployer = (bsData?.creator_address_hash || "").toLowerCase();
          if (deployer) {
            agentFastPlatform = BOT_PLATFORM_DEPLOYERS[deployer] || BOT_PLATFORM_LOCKERS[deployer] || null;
            if (!agentFastPlatform) {
              try {
                const bs2 = await fetch(`https://base.blockscout.com/api/v2/addresses/${encodeURIComponent(deployer)}`, { signal: AbortSignal.timeout(5000) });
                if (bs2.ok) {
                  const d2 = await bs2.json() as any;
                  const deployer2 = (d2?.creator_address_hash || "").toLowerCase();
                  if (deployer2) agentFastPlatform = BOT_PLATFORM_DEPLOYERS[deployer2] || BOT_PLATFORM_LOCKERS[deployer2] || null;
                }
              } catch {}
            }
          }
        }
      } catch {}
    }

    const [agGoplusResult, agDexResult] = await Promise.allSettled([
      agentFastPlatform
        ? Promise.resolve(null)
        : fetch(
            `${GOPLUS_BASE}/token_security/${BASE_CHAIN_ID}?contract_addresses=${encodeURIComponent(address)}`,
            { signal: AbortSignal.timeout(8_000) }
          ).then(r => r.json()),
      fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${address}`,
        { signal: AbortSignal.timeout(8_000) }
      ).then(r => r.json()),
    ]);

    const goplusData = agentFastPlatform ? null : (agGoplusResult.status === "fulfilled" ? agGoplusResult.value : null);
    const dexData    = agDexResult.status === "fulfilled" ? agDexResult.value : null;

    const tKey  = Object.keys(goplusData?.result ?? {})[0];
    const token = tKey ? (goplusData.result[tKey] as any) : null;

    let agAllPairs: any[] = dexData?.pairs ?? [];
    let agBasePairs = agAllPairs
      .filter((p: any) => p.chainId === "base")
      .sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));

    if (agBasePairs.length === 0) {
      try {
        const sq = token?.token_name || token?.token_symbol || "";
        if (sq) {
          const sRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(sq)}`, { signal: AbortSignal.timeout(6000) });
          if (sRes.ok) {
            const sData = await sRes.json() as any;
            const matched = (sData?.pairs ?? []).filter((p: any) =>
              p.chainId === "base" && (p.baseToken?.address?.toLowerCase() === address.toLowerCase() || p.quoteToken?.address?.toLowerCase() === address.toLowerCase())
            );
            if (matched.length > 0) agBasePairs = matched.sort((a: any, b: any) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
          }
        }
      } catch {}
    }

    const topPair = agBasePairs[0] ?? null;

    if (!token && !topPair && !agentFastPlatform) {
      return (
        `⚠️ *AGENT NOT FOUND*\n\n` +
        `Contract \`${address}\` not found on Base Mainnet.\n` +
        `Ensure the CA is correct.`
      );
    }

    let agentFastTokenInfo: { name: string; symbol: string } | null = null;
    if (agentFastPlatform && !token) {
      const rpcInfo = await botGetTokenInfo(address);
      if (rpcInfo) agentFastTokenInfo = rpcInfo;
    }
    const agentName   = esc(resolved.name   || token?.token_name   || agentFastTokenInfo?.name   || topPair?.baseToken?.name   || "Unknown Agent");
    const agentSymbol = esc(resolved.symbol || token?.token_symbol || agentFastTokenInfo?.symbol || topPair?.baseToken?.symbol || "?");

    // ── Market data ───────────────────────────────────────────────────────────
    const liqUsd     = topPair?.liquidity?.usd ?? null;
    const priceRaw   = parseFloat(topPair?.priceUsd ?? "0");
    const liqFmt     = liqUsd !== null ? fmtUsd(liqUsd) : "Data Pending";
    const priceFmt   = fmtPrice(priceRaw);
    const totalSupply = token?.total_supply ? parseFloat(token.total_supply) / (10 ** parseInt(token.decimals ?? "18")) : null;
    const fdvRaw     = topPair?.fdv ?? null;
    const mcapFmt    = fdvRaw ? fmtUsd(fdvRaw) : fmtMcap(priceRaw, totalSupply);
    let holderRaw = 0;
    const agBsCount = await botFetchHolderCount(address);
    if (agBsCount !== null && agBsCount > 0) {
      holderRaw = agBsCount;
    } else {
      holderRaw = parseInt(token?.holder_count ?? "0");
    }
    const holderFmt  = holderRaw > 0 ? holderRaw.toLocaleString() : "Scanning (High Activity)";

    // Social links from DexScreener
    const website  = topPair?.info?.websites?.[0]?.url ?? null;
    const twitter  = topPair?.info?.socials?.find((s: any) => s.type === "twitter")?.url ?? null;
    const telegram = topPair?.info?.socials?.find((s: any) => s.type === "telegram")?.url ?? null;

    // ── Contract security flags ────────────────────────────────────────────────
    const isHoneypot      = token ? flag(token.is_honeypot)              : false;
    const isVerified      = agentFastPlatform ? true : (token ? flag(token.is_open_source) : false);
    const isMintable      = token ? flag(token.is_mintable)              : false;
    const hasBlacklist    = token ? flag(token.is_blacklist)             : false;
    const ownerRecovery   = token ? flag(token.can_take_back_ownership)  : false;
    const ownerBal        = token ? flag(token.owner_change_balance)     : false;
    const hasCooldown     = token ? flag(token.trading_cooldown)         : false;
    const antiWhale       = token ? flag(token.anti_whale_modifiable)    : false;
    let agBuyTax          = parseFloat(token?.buy_tax  ?? "0");
    let agSellTax         = parseFloat(token?.sell_tax ?? "0");

    // ── LP lock — on-chain forensics via Blockscout deployer tracing ─────────
    const lpHolders: any[] = token?.lp_holders ?? [];
    const lpBurnedPct = lpHolders
      .filter(h => (h.tag ?? "").toLowerCase().includes("burn") ||
        (h.address ?? "").toLowerCase() === "0x000000000000000000000000000000000000dead")
      .reduce((acc, h) => acc + parseFloat(h.percent ?? "0") * 100, 0);
    const lpLockedPct = lpHolders
      .filter(h => flag(h.is_locked))
      .reduce((acc, h) => acc + parseFloat(h.percent ?? "0") * 100, 0);

    let agentLpEscrowName: string | null = agentFastPlatform;
    let agentIsKnownFactory = !!agentFastPlatform;

    const agentCreatorLower = (token?.creator_address || "").toLowerCase();
    const agentIsKnownOrigin = agentIsKnownFactory || ALL_BOT_FACTORY_ADDRESSES.has(agentCreatorLower) || lpHolders.some(lp => ALL_BOT_FACTORY_ADDRESSES.has((lp.address ?? "").toLowerCase()));

    if (agentIsKnownOrigin && BOT_PLATFORM_LOCKERS[agentCreatorLower]) {
      agentLpEscrowName = BOT_PLATFORM_LOCKERS[agentCreatorLower];
      agentIsKnownFactory = true;
    } else if (agentIsKnownOrigin && BOT_PLATFORM_DEPLOYERS[agentCreatorLower]) {
      agentLpEscrowName = BOT_PLATFORM_DEPLOYERS[agentCreatorLower];
      agentIsKnownFactory = true;
    } else if (agentIsKnownOrigin) {
      for (const lp of lpHolders) {
        const a = (lp.address ?? "").toLowerCase();
        if (BOT_PLATFORM_LOCKERS[a]) { agentLpEscrowName = BOT_PLATFORM_LOCKERS[a]; agentIsKnownFactory = true; break; }
      }
      if (!agentIsKnownFactory) { agentLpEscrowName = "Protocol"; agentIsKnownFactory = true; }
    } else if (BOT_PLATFORM_LOCKERS[agentCreatorLower]) {
      agentLpEscrowName = BOT_PLATFORM_LOCKERS[agentCreatorLower];
      agentIsKnownFactory = true;
    }

    if (!agentIsKnownFactory) {
      for (const lp of lpHolders) {
        const addr = (lp.address ?? "").toLowerCase();
        if (BOT_PLATFORM_LOCKERS[addr]) {
          agentLpEscrowName = BOT_PLATFORM_LOCKERS[addr];
          agentIsKnownFactory = true;
          break;
        }
      }
    }

    if (!agentIsKnownFactory) {
      const agBsTargets = lpHolders.slice(0, 3)
        .map(lp => ({ addr: (lp.address ?? "").toLowerCase(), pct: parseFloat(lp.percent ?? "0") * 100 }))
        .filter(t => t.addr && t.addr !== "0x0000000000000000000000000000000000000000" && t.addr !== "0x000000000000000000000000000000000000dead");
      if (agentCreatorLower && agentCreatorLower !== "0x0000000000000000000000000000000000000000") {
        agBsTargets.push({ addr: agentCreatorLower, pct: 100 });
      }

      const agBsResults = await Promise.allSettled(
        agBsTargets.map(t =>
          fetch(`https://base.blockscout.com/api/v2/addresses/${t.addr}`, { signal: AbortSignal.timeout(3_000) })
            .then(r => r.ok ? r.json() : null)
            .then(data => ({ ...t, deployer: (data?.creator_address_hash || "").toLowerCase() }))
        )
      );

      for (const r of agBsResults) {
        if (r.status !== "fulfilled" || !r.value.deployer) continue;
        if (BOT_PLATFORM_DEPLOYERS[r.value.deployer]) {
          agentLpEscrowName = BOT_PLATFORM_DEPLOYERS[r.value.deployer];
          agentIsKnownFactory = true;
          break;
        }
      }
    }

    const lpSecure = lpBurnedPct >= 50 || lpLockedPct >= 50 || agentIsKnownFactory;

    let agTaxOverride: string | null = null;
    if (agentIsKnownFactory && (agBuyTax > 0.50 || agSellTax > 0.50)) {
      agBuyTax = 0;
      agSellTax = 0;
      agTaxOverride = agentLpEscrowName;
    }
    const highTax = agBuyTax > 0.05 || agSellTax > 0.05;

    // ── AI Threat Assessment ──────────────────────────────────────────────────
    // Prompt Injection Risk: can the agent's logic be covertly altered?
    let promptRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    let promptDetail: string;
    if (isHoneypot) {
      promptRisk = "CRITICAL"; promptDetail = "Honeypot trap detected — agent blocks all exits";
    } else if (!isVerified && (ownerRecovery || ownerBal)) {
      promptRisk = "HIGH"; promptDetail = "Unverified code + privileged owner — logic override possible";
    } else if (!isVerified) {
      promptRisk = "MEDIUM"; promptDetail = "Source not verified — hidden logic cannot be ruled out";
    } else if (ownerRecovery || ownerBal) {
      promptRisk = "MEDIUM"; promptDetail = "Owner can alter contract state after deployment";
    } else {
      promptRisk = "LOW"; promptDetail = "No hidden logic or owner override detected";
    }

    // Data Exfiltration Risk: can the agent drain funds or trap users?
    let exfilRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    let exfilDetail: string;
    if (isHoneypot) {
      exfilRisk = "CRITICAL"; exfilDetail = "Funds sent in cannot be withdrawn — active drain mechanism";
    } else if (isMintable && !lpSecure) {
      exfilRisk = "HIGH"; exfilDetail = "Unlimited mint + unlocked liquidity enables coordinated rug";
    } else if (hasBlacklist && highTax) {
      exfilRisk = "HIGH"; exfilDetail = "Blacklist + elevated tax — users can be trapped and drained";
    } else if (!lpSecure && token) {
      exfilRisk = "MEDIUM"; exfilDetail = "Liquidity not locked — operator can pull pool at any time";
    } else if (isMintable || hasBlacklist) {
      exfilRisk = "MEDIUM"; exfilDetail = "Elevated operator privileges present";
    } else {
      exfilRisk = "LOW"; exfilDetail = "No fund drain mechanisms detected";
    }

    if (agentIsKnownFactory && !isHoneypot) {
      const factoryLabel = agentLpEscrowName || "Protocol";
      if (promptRisk !== "CRITICAL") { promptRisk = "LOW"; promptDetail = `${factoryLabel} — trusted factory origin`; }
      if (exfilRisk !== "CRITICAL") { exfilRisk = "LOW"; exfilDetail = `LP managed by ${factoryLabel}`; }
    }

    // ── Final verdict ─────────────────────────────────────────────────────────
    const criticalCount  = [promptRisk, exfilRisk].filter(r => r === "CRITICAL").length;
    const highCount      = [promptRisk, exfilRisk].filter(r => r === "HIGH").length;
    const noContract     = !token && !agentFastPlatform;
    const tinyLiquidity  = liqUsd !== null && liqUsd < 5_000;

    let verdict: string;
    let verdictLine: string;

    if (isHoneypot || criticalCount >= 1) {
      verdict = "⛔ LARP / THREAT";
      verdictLine = isHoneypot
        ? "Honeypot confirmed. This agent is a financial trap."
        : "Critical backdoor risk. Do not interact with this agent.";
    } else if (highCount >= 1 || (tinyLiquidity && noContract)) {
      verdict = "⛔ LARP / THREAT";
      verdictLine = tinyLiquidity && noContract
        ? "No contract data and negligible liquidity. Likely a LARP operation."
        : "High-severity attack vectors detected. This agent fails the APOL Agent audit.";
    } else if (agentIsKnownFactory) {
      verdict = "✅ CERTIFIED UNIT";
      verdictLine = `${agentLpEscrowName || "Protocol"} origin verified. LP managed by trusted factory.`;
    } else if (promptRisk === "MEDIUM" || exfilRisk === "MEDIUM" || !isVerified) {
      verdict = "⚠️ CAUTION ADVISED";
      verdictLine = "Moderate risks present. Not certified — due diligence required before interaction.";
    } else if (!token) {
      verdict = "⚠️ CAUTION ADVISED";
      verdictLine = "Insufficient contract data to certify. Verify the CA and try again.";
    } else {
      verdict = "✅ CERTIFIED UNIT";
      verdictLine = "Contract is clean, source verified, and no backdoors detected. Agent passes APOL Agent audit.";
    }

    const riskEmoji = (r: string) =>
      r === "CRITICAL" ? "🔴 CRITICAL" :
      r === "HIGH"     ? "🔴 HIGH"     :
      r === "MEDIUM"   ? "🟡 MEDIUM"   : "🟢 LOW";

    const verifiedFmt   = token ? (isVerified ? "Verified ✅" : "Unverified ⚠️") : "Data Pending";
    const mintFmt       = token ? (isMintable ? "Active ⚠️"   : "Disabled ✅")   : "Data Pending";
    const ownerFmt      = token
      ? (ownerRecovery || ownerBal ? "Privileged ⚠️" : "Renounced / Safe ✅")
      : "Data Pending";
    const taxFmt        = agTaxOverride
      ? `Protocol Managed (${agTaxOverride})`
      : (token ? `Buy ${pct(token.buy_tax)} / Sell ${pct(token.sell_tax)}` : "Data Pending");

    // ── Build message ─────────────────────────────────────────────────────────
    let msg = "";
    msg += `🤖 *APOL — AGENT INTELLIGENCE SCAN*\n\n`;
    msg += `🏷️ *Agent:* ${agentName} ($${agentSymbol})\n`;
    msg += `📍 *Contract:* \`${shortAddr(address)}\`\n`;
    msg += `⛓️ *Chain:* Base Mainnet\n\n`;

    msg += `🔬 *AGENT CONTRACT ANALYSIS*\n`;
    msg += `Source Code: ${verifiedFmt}\n`;
    msg += `Mint Authority: ${mintFmt}\n`;
    msg += `Owner Controls: ${ownerFmt}\n`;
    msg += `Tax: ${taxFmt}\n\n`;

    msg += `🧠 *AI THREAT ASSESSMENT*\n`;
    msg += `Prompt Injection Risk: ${riskEmoji(promptRisk)}\n`;
    msg += `_${esc(promptDetail)}_\n\n`;
    msg += `Data Exfiltration Risk: ${riskEmoji(exfilRisk)}\n`;
    msg += `_${esc(exfilDetail)}_\n\n`;

    msg += `💧 *MARKET INTEL*\n`;
    msg += `Liquidity: ${liqFmt}\n`;
    msg += `Price: ${priceFmt}\n`;
    msg += `Market Cap: ${mcapFmt}\n`;
    msg += `Holders: ${holderFmt}\n`;

    if (website || twitter || telegram) {
      msg += `\n🔗 *SOCIALS*\n`;
      if (website)  msg += `Web: ${website}\n`;
      if (twitter)  msg += `Twitter: ${twitter}\n`;
      if (telegram) msg += `Telegram: ${telegram}\n`;
    }

    msg += `\n*VERDICT: ${verdict}*\n`;
    msg += `_${esc(verdictLine)}_\n\n`;
    msg += `🔍 [Full Deep Dive](${siteUrl}/agent-scanner)`;

    return msg;

  } catch (err: any) {
    console.error("[APOL Bot] Agent scan error:", err?.message ?? err);
    return `❌ *Agent Scan Failed*\n\nCould not reach the intelligence database. Please try again in a moment.`;
  }
}

// ─── Social Forensics ────────────────────────────────────────────────────────

const RAPIDAPI_HOST = "twitter241.p.rapidapi.com";

function parseXUsername(input: string): string {
  let u = input.trim();
  // Strip leading @ if present
  u = u.replace(/^@/, "");
  // Strip full URL: https://twitter.com/username or https://x.com/username
  u = u.replace(/^(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\//, "");
  // Strip trailing path and query
  u = u.split("/")[0].split("?")[0].split(" ")[0];
  return u;
}

async function buildSocialScan(input: string, siteUrl: string): Promise<string> {
  try {
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

    if (!RAPIDAPI_KEY) {
      return (
        `🐦 *APOL X INVESTIGATION — OFFLINE*\n\n` +
        `The social forensics module is not yet configured.\n` +
        `Admin must add the \`RAPIDAPI_KEY\` secret to enable /scanx.\n\n` +
        `_Subscribe free at rapidapi.com → search "Twttr API" (twitter241)_`
      );
    }

    const username = parseXUsername(input);
    if (!username || username.length < 1 || username.length > 50) {
      return (
        `⚠️ *Invalid Username*\n\n` +
        `Usage: /scanx @username or /scanx https://x.com/username`
      );
    }

    const isApolSelf = ["apol_agent", "apolagent"].includes(username.toLowerCase());

    const headers: Record<string, string> = {
      "x-rapidapi-key":  RAPIDAPI_KEY,
      "x-rapidapi-host": RAPIDAPI_HOST,
    };

    // ── Step 1: Fetch user profile by username ────────────────────────────────
    const userRes = await fetch(
      `https://${RAPIDAPI_HOST}/user?username=${encodeURIComponent(username)}`,
      { headers, signal: AbortSignal.timeout(8_000) }
    );
    const userRaw: any = await userRes.json();

    // twitter241: result.data.user.result → core (name/created_at) + legacy (counts)
    const userResult: any = userRaw?.result?.data?.user?.result ?? {};
    const legacy: any     = userResult?.legacy ?? {};
    const core: any       = userResult?.core   ?? {};

    if (!legacy?.followers_count && !core?.name) {
      return (
        `⚠️ *Account Not Found*\n\n` +
        `No X profile found for "${esc(username)}".\n` +
        `Ensure the handle is correct and the account is public.`
      );
    }

    // ── Step 2: Fetch recent tweets by user ID ────────────────────────────────
    const userId = userResult?.rest_id ?? "";
    let tweets: any[] = [];
    if (userId) {
      try {
        const tweetsRes = await fetch(
          `https://${RAPIDAPI_HOST}/user-tweets?user_id=${encodeURIComponent(userId)}&count=5`,
          { headers, signal: AbortSignal.timeout(8_000) }
        );
        const tweetsData: any = await tweetsRes.json();
        // twitter241 GraphQL timeline format
        const instructions: any[] = tweetsData?.result?.timeline?.instructions ?? [];
        const entries: any[] = instructions.find((i: any) => i?.type === "TimelineAddEntries")?.entries ?? [];
        tweets = entries
          .map((e: any) => e?.content?.itemContent?.tweet_results?.result?.legacy)
          .filter(Boolean)
          .slice(0, 5);
      } catch { /* non-fatal — continue without tweet data */ }
    }

    // ── Parse profile ─────────────────────────────────────────────────────────
    // twitter241: name/screen_name/created_at live in core; counts in legacy
    const displayName  = core.name              ?? username;
    const followers    = parseInt(legacy.followers_count ?? "0");
    const following    = parseInt(legacy.friends_count   ?? "0");
    const isVerified   = !!(userResult.is_blue_verified  || legacy.verified);
    const totalTweets  = parseInt(legacy.statuses_count  ?? "0");
    const bio          = legacy.description ?? "";

    // Account age (Twitter format: "Mon Jun 28 17:54:05 +0000 2011")
    let joinedDate = "Unknown";
    let ageDays    = 0;
    if (core.created_at) {
      const createdAt = new Date(core.created_at);
      if (!isNaN(createdAt.getTime())) {
        joinedDate = createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        ageDays    = Math.floor((Date.now() - createdAt.getTime()) / 86_400_000);
      }
    }

    // ── Engagement analysis (last 5 tweets) ───────────────────────────────────
    const recentTweets: any[] = tweets;

    const avgLikes    = recentTweets.length > 0
      ? Math.round(recentTweets.reduce((s, t) => s + (parseInt(t.favorite_count  ?? "0")), 0) / recentTweets.length)
      : 0;
    const avgRetweets = recentTweets.length > 0
      ? Math.round(recentTweets.reduce((s, t) => s + (parseInt(t.retweet_count ?? "0")), 0) / recentTweets.length)
      : 0;

    const followRatio     = following > 0 ? (followers / following).toFixed(2) : "∞";
    const engagementPct   = followers > 0
      ? ((avgLikes + avgRetweets) / followers * 100)
      : 0;

    // ── Risk flags ────────────────────────────────────────────────────────────
    const flags: string[] = [];

    if (isApolSelf) {
      if (ageDays > 0 && ageDays < 90) {
        flags.push("🟢 PLANNED DEPLOYMENT — Sentinel Initial Phase");
      }
    } else {
      if (ageDays > 0 && ageDays < 30) {
        flags.push("⛔ HIGH RISK FRESH ACCOUNT — Profile less than 30 days old");
      } else if (ageDays > 0 && ageDays < 90) {
        flags.push("⚠️ New account — less than 90 days old");
      }

      if (followers > 10_000 && tweets.length > 0 && avgLikes < 10) {
        flags.push("⛔ BOTTED FOLLOWERS — 10K+ followers but avg < 10 likes");
      }

      if (following > followers * 3 && followers < 2_000) {
        flags.push("⚠️ Follow-back pattern — following far exceeds followers");
      }

      if (totalTweets < 5 && followers > 500) {
        flags.push("⚠️ Ghost account — very few posts for follower count");
      }

      if (engagementPct > 20 && followers > 500) {
        flags.push("⚠️ Unusually high engagement — verify authenticity");
      }
    }

    // ── Engagement rating ─────────────────────────────────────────────────────
    let engagementRating: string;
    if (recentTweets.length === 0) {
      engagementRating = "Data Pending";
    } else if (engagementPct >= 2.0) {
      engagementRating = `High ✅ (avg ${avgLikes}❤️ / ${avgRetweets}🔁)`;
    } else if (engagementPct >= 0.3) {
      engagementRating = `Average (avg ${avgLikes}❤️ / ${avgRetweets}🔁)`;
    } else {
      engagementRating = `Low ⚠️ (avg ${avgLikes}❤️ / ${avgRetweets}🔁)`;
    }

    // ── Verdict ───────────────────────────────────────────────────────────────
    let verdict: string;

    if (isApolSelf) {
      verdict = "✅ AUTHENTICATED — Official APOL Forensic Node detected. Trace is valid.";
    } else {
      const critFlags = flags.filter(f => f.startsWith("⛔")).length;
      const warnFlags = flags.filter(f => f.startsWith("⚠️")).length;

      if (critFlags >= 1) {
        verdict = "⛔ WARNING: BOT ACTIVITY DETECTED";
      } else if (warnFlags >= 2) {
        verdict = "⚠️ CAUTION: Multiple Suspicious Patterns";
      } else if (warnFlags === 1) {
        verdict = "⚠️ CAUTION: Suspicious Patterns Detected";
      } else if (ageDays > 365 && followers > 1_000 && engagementPct >= 0.3) {
        verdict = "✅ Likely Authentic";
      } else if (ageDays < 180 || followers < 100) {
        verdict = "⚠️ Inconclusive — Insufficient History";
      } else {
        verdict = "✅ No Red Flags Detected";
      }
    }

    // ── Linked CA from DexScreener ────────────────────────────────────────────
    let linkedCA = "Not Found";
    let linkedWallet: string | null = null;
    try {
      const dexSearch: any = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(username)}`,
        { signal: AbortSignal.timeout(8_000) }
      ).then(r => r.json());

      const basePairs: any[] = (dexSearch?.pairs ?? []).filter((p: any) => p.chainId === "base");
      const match = basePairs.find((p: any) =>
        (p.info?.socials ?? []).some((s: any) =>
          s.type === "twitter" && s.url.toLowerCase().includes(username.toLowerCase())
        )
      );
      if (match) {
        linkedCA = `${esc(match.baseToken.symbol)} — \`${match.baseToken.address}\``;
        linkedWallet = match.baseToken.address;
      }
    } catch { /* non-fatal */ }

    // ── Agent Cognition Cross-Reference ─────────────────────────────────────
    let cognitionScore: number | null = null;
    let agentVerdict: string | null = null;
    let agentApolVerdict: string | null = null;
    if (!isApolSelf) {
      try {
        const agentRes = await fetch(`${siteUrl}/api/agent/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentName: displayName || username,
            socialLink: `https://x.com/${username}`,
            wallet: linkedWallet,
            chain: "base",
          }),
          signal: AbortSignal.timeout(8_000),
        });
        const agentData: any = await agentRes.json();
        cognitionScore = agentData.cognitionScore;
        agentVerdict = agentData.verdict;
        agentApolVerdict = agentData.apolVerdict;
      } catch { /* non-fatal — social-only fallback */ }
    }

    // ── Build message ─────────────────────────────────────────────────────────
    let msg = "";
    msg += `🐦 *X INVESTIGATION: @${esc(username)}*\n\n`;
    msg += `👤 *Name:* ${esc(displayName)}\n`;
    if (bio) msg += `📝 *Bio:* _${esc(bio.replace(/\n/g, " ").slice(0, 120))}_\n`;
    msg += `📅 *Joined:* ${joinedDate} (${ageDays} days ago)\n`;
    msg += `✅ *Blue Check:* ${isVerified ? "Verified ✅" : "Not Verified"}\n\n`;

    msg += `👥 *Followers:* ${followers.toLocaleString()}\n`;
    msg += `➡️ *Following:* ${following.toLocaleString()}\n`;
    msg += `📊 *Follow Ratio:* ${followRatio}:1\n`;
    msg += `📈 *Engagement:* ${engagementRating}\n\n`;

    if (flags.length > 0) {
      msg += `🚨 *SOCIAL FLAGS:*\n`;
      flags.forEach(f => (msg += `  ${f}\n`));
      msg += "\n";
    } else {
      msg += `✅ *No social risk flags detected.*\n\n`;
    }

    msg += `⛓️ *Linked CA:* ${linkedCA}\n\n`;

    // ── Unified verdict: combine social + agent cognition ───────────────────
    if (isApolSelf) {
      msg += `🧠 *Cognition Score:* 100% — Fully Autonomous\n`;
      msg += `🚨 *Verdict:* _✅ AUTHENTICATED — Official APOL Forensic Node detected. Trace is valid._\n\n`;
      msg += `_The Sentinel is new, but the logic is ancient. Verification complete._ 🦍🔐\n\n`;
    } else {
      msg += `🚨 *Social Verdict:* _${verdict}_\n\n`;

      const missing: string[] = [];
      if (!linkedWallet) missing.push("Agent Wallet / CA");
      missing.push("Logs URL / API Endpoint");

      if (missing.length > 0) {
        msg += `📋 *Missing Data:*\n`;
        missing.forEach(m => (msg += `  ⚪ ${m}\n`));
        msg += `\n⚠️ _This verdict is based only on social profile data. A full AI autonomy verdict requires a wallet address and reasoning logs. Use /scanagent with full details for a complete assessment._\n\n`;
      }

      if (cognitionScore !== null && agentVerdict) {
        const scoreEmoji = cognitionScore >= 71 ? "🟢" : cognitionScore >= 31 ? "🟡" : "🔴";
        msg += `🧠 *Partial Cognition Score:* ${scoreEmoji} ${cognitionScore}% — ${agentVerdict}\n`;
        msg += `_Based on available data only. Score may change with wallet/logs._\n\n`;
      }
    }

    msg += `🔍 [Full Report](${siteUrl}/agent-scanner)`;

    return msg;

  } catch (err: any) {
    console.error("[APOL Bot] Social scan error:", err?.message ?? err);
    return `❌ *Social Scan Failed*\n\nCould not reach the X intelligence feed. Please try again in a moment.`;
  }
}

// ─── Bot Factory ─────────────────────────────────────────────────────────────

export function createBot(): Telegraf | null {
  const token = process.env.APOL_BOT_TOKEN;
  if (!token) {
    console.log("[APOL Bot] APOL_BOT_TOKEN not set — Telegram bot disabled.");
    return null;
  }

  const bot  = new Telegraf(token, { telegram: { webhookReply: false } });
  const site = getSiteUrl();

  // ── Global error handler ──────────────────────────────────────────────────
  bot.catch((err: any, ctx: any) => {
    const code = err?.response?.error_code ?? err?.code;
    if (code === 403) return;
    if (code === 401) { console.error("[APOL Bot] Unauthorized (401) — check token."); return; }
    if (code === 404) return;
    if (code === 400 && err?.message?.includes("message is not modified")) return;
    console.error(`[APOL Bot] Unhandled error (${ctx?.updateType}):`, err?.message ?? err);
  });

  // ── /start ────────────────────────────────────────────────────────────────
  bot.start(ctx =>
    ctx.replyWithMarkdown(
      `🚨 *APOL AGENT ONLINE*\n` +
      `Protecting the Base trenches.\n\n` +
      `Use /scan [address] to check a contract or /report to flag a larp.\n\n` +
      `*AVAILABLE COMMANDS*\n` +
      `🔍 /scan [contract] — Token security check\n` +
      `🐦 /scanx [username] — X/Twitter social forensics\n` +
      `🤖 /scanagent [name or CA] — AI agent audit\n` +
      `👮 /checkwallet [address] — Wallet investigation\n` +
      `🚩 /report — Submit scam evidence\n` +
      `🗺️ /map — Wall of Shame\n` +
      `🛡️ /verified — Certified projects\n` +
      `❓ /help — Help`
    ).catch(() => ctx.reply(
      "🚨 APOL AGENT ONLINE.\nUse /scan [address] to check a contract or /report to flag a larp.\n\nCommands: /scan /report /map /verified /help"
    ))
  );

  // ── /help ─────────────────────────────────────────────────────────────────
  bot.help(ctx =>
    ctx.replyWithMarkdown(
      `🚔 *APOL AGENT — HELP DESK*\n\n` +
      `🔍 /scan [address] — Token contract security scan\n` +
      `🐦 /scanx [@username] — X/Twitter social forensics & LARP detection\n` +
      `🤖 /scanagent [name or CA] — AI agent intelligence audit\n` +
      `👮 /checkwallet [address] — Wallet forensics & threat investigation\n` +
      `🚩 /report — Report a suspected scam or LARP agent\n` +
      `🗺️ /map — View the Wall of Shame\n` +
      `🛡️ /verified — Browse APOL-certified projects\n\n` +
      `_Questions? Join the community._`,
      { disable_web_page_preview: true }
    )
  );

  // ── /scan [address] ───────────────────────────────────────────────────────
  bot.command("scan", async ctx => {
    const parts   = (ctx.message.text ?? "").trim().split(/\s+/);
    const address = parts[1]?.trim();

    if (!address) {
      return ctx.replyWithMarkdown(
        `❓ *Usage:* /scan [contract address]\n\nExample: \`/scan 0x1234...abcd\``
      );
    }

    if (!isEvmAddress(address)) {
      return ctx.replyWithMarkdown(
        `⚠️ *Invalid address.*\n\nPlease provide a valid EVM address starting with \`0x\` (42 chars).`
      );
    }

    let loadingMsg: { message_id: number; chat: { id: number } } | null = null;
    try {
      loadingMsg = await ctx.replyWithMarkdown(
        `🔍 *Analyzing Forensic Data...*\n\n` +
        `📍 \`${shortAddr(address)}\`\n` +
        `_Consulting APOL intelligence database. This may take a moment..._`
      );
    } catch { /* non-fatal */ }

    const alchemyPreCheck = (async () => {
      try {
        const t0 = Date.now();
        const [dexPre, tokenInfo] = await Promise.all([
          botCheckDualDex(address),
          botGetTokenInfo(address),
        ]);
        const elapsed = Date.now() - t0;
        if (elapsed < 4000 && dexPre.isInDex && tokenInfo && loadingMsg) {
          const quickLabel = botDexLiveStatus(dexPre.version) || "Live ✅";
          const quickMsg =
            `🔍 *APOL AGENT — QUICK SCAN*\n\n` +
            `📍 \`${shortAddr(address)}\`\n` +
            `⛓️ Base Mainnet\n\n` +
            `*${tokenInfo.name}* ($${tokenInfo.symbol})\n` +
            `📡 Status: *${quickLabel}*\n` +
            `_Full forensic report loading..._`;
          try {
            await ctx.telegram.editMessageText(
              loadingMsg.chat.id, loadingMsg.message_id, undefined,
              quickMsg, { parse_mode: "Markdown", disable_web_page_preview: true } as any,
            );
            console.log(`[bot] Alchemy pre-check completed in ${elapsed}ms — quick status (${dexPre.version}) sent for ${address.slice(0,10)}`);
          } catch { /* non-fatal */ }
        }
      } catch { /* non-fatal */ }
    })();

    const SCAN_TIMEOUT_MSG =
      `⚠️ *Scan Timeout*\n\n` +
      `The scan is taking longer than expected. External APIs may be slow.\n\n` +
      `Try the full scanner at [${site}](${site}/agent-scanner) for faster results.`;

    const snapshot = await withTimeout(buildSnapshot(address, site), 60_000, SCAN_TIMEOUT_MSG);

    if (loadingMsg) {
      try {
        await ctx.telegram.editMessageText(
          loadingMsg.chat.id, loadingMsg.message_id, undefined,
          snapshot, { parse_mode: "Markdown", disable_web_page_preview: true } as any,
        );
        return;
      } catch (e: any) {
        if (e?.response?.error_code === 400 && e?.response?.description?.includes("parse entities")) {
          try {
            await ctx.telegram.editMessageText(
              loadingMsg.chat.id, loadingMsg.message_id, undefined,
              stripMd(snapshot), { disable_web_page_preview: true } as any,
            );
            return;
          } catch { /* fall through */ }
        }
        try { await ctx.telegram.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id); } catch { /* non-fatal */ }
      }
    }

    try {
      return await ctx.replyWithMarkdown(snapshot, { disable_web_page_preview: true });
    } catch {
      return ctx.reply(stripMd(snapshot), { disable_web_page_preview: true } as any);
    }
  });

  // ── /checkwallet [address] ────────────────────────────────────────────────
  bot.command("checkwallet", async ctx => {
    const parts   = (ctx.message.text ?? "").trim().split(/\s+/);
    const address = parts[1]?.trim();

    if (!address) {
      return ctx.replyWithMarkdown(
        `❓ *Usage:* /checkwallet [wallet address]\n\nExample: \`/checkwallet 0x1234...abcd\``
      );
    }

    if (!isEvmAddress(address)) {
      return ctx.replyWithMarkdown(
        `⚠️ *Invalid address.*\n\nPlease provide a valid EVM address starting with \`0x\` (42 chars).`
      );
    }

    let loadingMsg: { message_id: number; chat: { id: number } } | null = null;
    try {
      loadingMsg = await ctx.replyWithMarkdown(
        `🔍 *Analyzing Forensic Data...*\n\n` +
        `📍 \`${shortAddr(address)}\`\n` +
        `_Checking APOL intelligence records..._`
      );
    } catch { /* non-fatal */ }

    const WALLET_TIMEOUT_MSG =
      `⚠️ *Wallet Check Timeout*\n\n` +
      `The investigation is taking longer than expected. Try again in a moment.`;
    const report = await withTimeout(buildWalletCheck(address), 20_000, WALLET_TIMEOUT_MSG);

    if (loadingMsg) {
      try {
        await ctx.telegram.editMessageText(
          loadingMsg.chat.id, loadingMsg.message_id, undefined,
          report, { parse_mode: "Markdown", disable_web_page_preview: true } as any,
        );
        return;
      } catch (e: any) {
        if (e?.response?.error_code === 400 && e?.response?.description?.includes("parse entities")) {
          try {
            await ctx.telegram.editMessageText(
              loadingMsg.chat.id, loadingMsg.message_id, undefined,
              stripMd(report), { disable_web_page_preview: true } as any,
            );
            return;
          } catch { /* fall through */ }
        }
        try { await ctx.telegram.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id); } catch { /* non-fatal */ }
      }
    }

    try {
      return await ctx.replyWithMarkdown(report, { disable_web_page_preview: true });
    } catch {
      return ctx.reply(stripMd(report), { disable_web_page_preview: true } as any);
    }
  });

  // ── /scanagent ────────────────────────────────────────────────────────────
  bot.command("scanagent", async ctx => {
    const parts = (ctx.message.text ?? "").trim().split(/\s+/);
    const input = parts.slice(1).join(" ").trim();

    if (!input) {
      return ctx.replyWithMarkdown(
        `❓ *Usage:* /scanagent [Agent Name or CA]\n\n` +
        `Examples:\n` +
        `\`/scanagent AIXBT\`\n` +
        `\`/scanagent 0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825\`\n\n` +
        `_Scans the AI agent's contract for Prompt Injection & Data Exfiltration risks._`
      );
    }

    let loadingMsg: { message_id: number; chat: { id: number } } | null = null;
    try {
      loadingMsg = await ctx.replyWithMarkdown(
        `🔍 *Analyzing Forensic Data...*\n\n` +
        `🤖 _${esc(input)}_\n` +
        `_Running APOL AgentGuard intelligence. This may take a moment..._`
      );
    } catch { /* non-fatal */ }

    const AGENT_TIMEOUT_MSG =
      `⚠️ *Agent Scan Timeout*\n\n` +
      `The scan is taking longer than expected. External APIs may be slow.\n\n` +
      `Try the full scanner at [${site}](${site}/agent-scanner) for faster results.`;
    const report = await withTimeout(buildAgentScan(input, site), 60_000, AGENT_TIMEOUT_MSG);

    if (loadingMsg) {
      try {
        await ctx.telegram.editMessageText(
          loadingMsg.chat.id, loadingMsg.message_id, undefined,
          report, { parse_mode: "Markdown", disable_web_page_preview: true } as any,
        );
        return;
      } catch (e: any) {
        if (e?.response?.error_code === 400 && e?.response?.description?.includes("parse entities")) {
          try {
            await ctx.telegram.editMessageText(
              loadingMsg.chat.id, loadingMsg.message_id, undefined,
              stripMd(report), { disable_web_page_preview: true } as any,
            );
            return;
          } catch { /* fall through */ }
        }
        try { await ctx.telegram.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id); } catch { /* non-fatal */ }
      }
    }

    try {
      return await ctx.replyWithMarkdown(report, { disable_web_page_preview: true });
    } catch {
      return ctx.reply(stripMd(report), { disable_web_page_preview: true } as any);
    }
  });

  // ── /scanx ────────────────────────────────────────────────────────────────
  bot.command("scanx", async ctx => {
    const parts = (ctx.message.text ?? "").trim().split(/\s+/);
    const input = parts.slice(1).join(" ").trim();

    if (!input) {
      return ctx.replyWithMarkdown(
        `❓ *Usage:* /scanx [@username or profile link]\n\n` +
        `Examples:\n` +
        `\`/scanx @VitalikButerin\`\n` +
        `\`/scanx https://x.com/apolagent\`\n\n` +
        `_Runs a social forensics investigation: account age, follower quality, engagement, LARP detection._`
      );
    }

    let loadingMsg: { message_id: number; chat: { id: number } } | null = null;
    try {
      const preview = parseXUsername(input);
      loadingMsg = await ctx.replyWithMarkdown(
        `🔍 *Analyzing Forensic Data...*\n\n` +
        `🐦 _@${esc(preview)}_\n` +
        `_Running APOL social forensics..._`
      );
    } catch { /* non-fatal */ }

    const SOCIAL_TIMEOUT_MSG =
      `⚠️ *Social Scan Timeout*\n\n` +
      `The X forensics module is taking longer than expected. Try again in a moment.`;
    const report = await withTimeout(buildSocialScan(input, site), 60_000, SOCIAL_TIMEOUT_MSG);

    if (loadingMsg) {
      try {
        await ctx.telegram.editMessageText(
          loadingMsg.chat.id, loadingMsg.message_id, undefined,
          report, { parse_mode: "Markdown", disable_web_page_preview: true } as any,
        );
        return;
      } catch (e: any) {
        if (e?.response?.error_code === 400 && e?.response?.description?.includes("parse entities")) {
          try {
            await ctx.telegram.editMessageText(
              loadingMsg.chat.id, loadingMsg.message_id, undefined,
              stripMd(report), { disable_web_page_preview: true } as any,
            );
            return;
          } catch { /* fall through */ }
        }
        try { await ctx.telegram.deleteMessage(loadingMsg.chat.id, loadingMsg.message_id); } catch { /* non-fatal */ }
      }
    }

    try {
      return await ctx.replyWithMarkdown(report, { disable_web_page_preview: true });
    } catch {
      return ctx.reply(stripMd(report), { disable_web_page_preview: true } as any);
    }
  });

  // ── /report ───────────────────────────────────────────────────────────────
  bot.command("report", ctx =>
    ctx.replyWithMarkdown(
      `🚩 *REPORT A SCAM OR LARP*\n\n` +
      `Submit your evidence securely via the APOL Evidence Portal:\n\n` +
      `🔗 [Submit Evidence](${site}/report-scam)\n\n` +
      `_Your report will be reviewed by APOL officers. Confirmed cases are added to the Wall of Shame._`,
      { disable_web_page_preview: true }
    )
  );

  // ── /map ──────────────────────────────────────────────────────────────────
  bot.command("map", ctx =>
    ctx.replyWithMarkdown(
      `🗺️ *WALL OF SHAME*\n\n` +
      `Live database of confirmed scammers, rug pullers, and LARP agents on Base:\n\n` +
      `🔗 [View Wall of Shame](${site}/report-scam)\n\n` +
      `_Updated in real-time as reports are verified by APOL officers._`,
      { disable_web_page_preview: true }
    )
  );

  // ── /verified ─────────────────────────────────────────────────────────────
  bot.command("verified", ctx =>
    ctx.replyWithMarkdown(
      `🛡️ *APOL VERIFIED BUILDERS*\n\n` +
      `Projects that have passed the full APOL Agent audit:\n\n` +
      `🔗 [View Certified Projects](${site}/verified-builders)\n\n` +
      `_Each listed project has passed contract security review, team vetting, and community scrutiny._`,
      { disable_web_page_preview: true }
    )
  );

  return bot;
}
