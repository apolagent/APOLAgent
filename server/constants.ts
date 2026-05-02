export const WETH = "0x4200000000000000000000000000000000000006" as const;
export const QUOTER_V2 = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a" as const;
export const V3_FACTORY = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD" as const;
export const SIM_AMOUNT = BigInt("1000000000000000");
export const MICRO_AMOUNT = BigInt("1000000000000");
export const HARD_TIMEOUT = 10000 as const;
export const FEE_TIERS = Object.freeze([500, 3000, 10000, 100] as const);

export const BURN_ADDRS: ReadonlySet<string> = Object.freeze(new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]));

export const PLATFORM_MAP: Readonly<Record<string, string>> = Object.freeze({
  "0xdad686299fb562f89e55da05f1d96fabeb2a2e32": "Virtuals",
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": "Virtuals",
  "0x97cf38bb06da57b6418083998b09976ec40a90a3": "Virtuals",
  "0xe85a59c628f7d27878aceb4bf3b35733630083a9": "Clanker",
  "0x2a787b2362021cc3eea3c24c4748a6cd5b687382": "Clanker",
  "0xe85a08cf16f07b0b6e8b1f5e4918f6e9dab3a5c0": "Clanker",
  "0xf3622742b1e446d92e45e22923ef11c2fcd55d68": "Clanker",
  "0x6a53f8b799be11a2a3264ef0bff183dcb12d9571": "Flaunch",
  "0xce0e4e4d2dc0033ce2dd0ec79abe6186106f0462": "Flaunch",
  "0x39112541720078c70164ea4deb61f0a4811910f9": "Flaunch",
  "0xc785de52b739930ab0864b0ae7896ed6e327628a": "Flaunch",
  "0x45edccb44da8aa1bf4b9e4f2baae61760d1c8fb9": "Flaunch",
  "0xf1eeeeeeecd95e9eb2df58484ceed175acbd945c": "Flaunch",
  "0x000000000d564d5be76f7f0d28fe52605afc7cf8": "Flaunch",
  "0x0bf8edd756ff6caf3f583d67a9fd8b237e40f58a": "ApeStore",
  "0xade20c0cc8482c404a57da404ed1f3f2a1f6fe6f": "ApeStore",
  "0xade256e1c2763b8766efe1eeb7c578d93f621f6f": "ApeStore",
  "0xb1900f41d78d330a2a35c6771b3a6088a1b51309": "ApeStore",
});

export const LOCKER_MAP: Readonly<Record<string, string>> = Object.freeze({
  "0xe85a59c628f7d27878aceb4bf3b35733630083a9": "Clanker",
  "0x2a787b2362021cc3eea3c24c4748a6cd5b687382": "Clanker",
  "0xe85a08cf16f07b0b6e8b1f5e4918f6e9dab3a5c0": "Clanker",
  "0xf3622742b1e446d92e45e22923ef11c2fcd55d68": "Clanker",
  "0x663a5c229c09b049e36dcc11a9b0d4a8eb9db214": "Unicrypt",
  "0x71b5759d73262fbb223956913ecf4ecc51057641": "PinkLock",
  "0xe2fe530c047f2d85298b07d9333c05737f1435fb": "Team Finance",
  "0x0bf8edd756ff6caf3f583d67a9fd8b237e40f58a": "ApeStore",
  "0xade20c0cc8482c404a57da404ed1f3f2a1f6fe6f": "ApeStore",
  "0xdad686299fb562f89e55da05f1d96fabeb2a2e32": "Virtuals",
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": "Virtuals",
  "0x97cf38bb06da57b6418083998b09976ec40a90a3": "Virtuals",
  "0x6a53f8b799be11a2a3264ef0bff183dcb12d9571": "Flaunch",
  "0xce0e4e4d2dc0033ce2dd0ec79abe6186106f0462": "Flaunch",
});

export const CREATION_LOG_SIGNATURES: Readonly<Record<string, string>> = Object.freeze({
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": "Virtuals",
  "0xdad686299fb562f89e55da05f1d96fabeb2a2e32": "Virtuals",
  "0x97cf38bb06da57b6418083998b09976ec40a90a3": "Virtuals",
});

export const MANAGED_PROTOCOLS: ReadonlySet<string> = Object.freeze(new Set([
  "Virtuals",
  "Clanker",
  "Flaunch",
]));

export const DEPLOYER_CHAIN_KEYWORDS: Readonly<Record<string, { names: readonly string[]; sourcePatterns: readonly string[] }>> = Object.freeze({
  Flaunch: { names: Object.freeze(["flaunch", "flayer"]), sourcePatterns: Object.freeze(["@flaunch/", "flaunchzap"]) },
  Clanker: { names: Object.freeze(["clanker"]), sourcePatterns: Object.freeze(["clanker"]) },
  ApeStore: { names: Object.freeze(["apestore", "ape.store"]), sourcePatterns: Object.freeze([]) },
  Virtuals: { names: Object.freeze(["virtuals"]), sourcePatterns: Object.freeze([]) },
});

export const VERIFIED_AGENTS: Readonly<Record<string, { name: string; symbol: string; protocol: string }>> = Object.freeze({
  "0x55cd6469f597452b5a7536e2cd98fde4c1247ee4": { name: "Luna", symbol: "LUNA", protocol: "Virtuals" },
  "0x4f9fd6be4a90f2620860d680c0d4d5fb53d1a825": { name: "aixbt", symbol: "AIXBT", protocol: "Virtuals" },
  "0x1c4cca7c5db003824208adda61bd749e55f463a3": { name: "Game", symbol: "GAME", protocol: "Virtuals" },
  "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": { name: "Virtuals Protocol", symbol: "VIRTUAL", protocol: "Virtuals" },
});

export const BLOCKSCOUT_BASE = "https://base.blockscout.com" as const;
export const DEXSCREENER_BASE = "https://api.dexscreener.com" as const;
export const GOPLUS_BASE = "https://api.gopluslabs.io" as const;
export const BLOCKAID_BASE = "https://api.blockaid.io" as const;
export const CLANKER_API_BASE = "https://clanker.world" as const;
export const BASE_CHAIN_ID = "8453" as const;
export const SERIAL_DEPLOYER_THRESHOLD = 3 as const;
export const SERIAL_DEPLOYER_WINDOW_DAYS = 2 as const;
