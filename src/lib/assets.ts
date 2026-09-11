/** Display taxonomy, keyed by Ethereum contract identity, never by a token's ticker. */
export interface AssetProfile {
  group: string;
  underlying: string;
  type: string;
  description: string;
  priceMaxAgeHours: number;
}

const profiles: Record<string, AssetProfile> = {};
function add(address: string, group: string, type: string, description: string, priceMaxAgeHours = 1) {
  profiles[address] = { group: type, type, underlying: group, description, priceMaxAgeHours };
}
add(
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
  "Bitcoin",
  "Custodied BTC",
  "An Ethereum token representing BTC held in custody. Its backing and redemption depend on the custodian and merchant network.",
);
add(
  "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf",
  "Bitcoin",
  "Custodied BTC",
  "An Ethereum token representing BTC held by Coinbase. It combines Bitcoin price exposure with issuer and custody dependencies.",
);
add(
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  "Ether",
  "Wrapped ETH",
  "ETH held in an Ethereum wrapper contract, allowing it to be used as an ERC-20 token.",
);
add(
  "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0",
  "Ether",
  "Staked ETH",
  "wstETH represents stETH, which represents ETH staked through Lido. Its value depends on ETH, accrued staking rewards, and the staking and redemption arrangements.",
);
add(
  "0x8c1bed5b9a0928467c9b1341da1d7bd5e10b6549",
  "Ether",
  "Staked ETH",
  "A liquid staking token representing ETH staked through Liquid Collective, with staking, contract and redemption dependencies.",
);
add(
  "0x45804880de22913dafe09f4980848ece6ecbaf78",
  "Gold",
  "Tokenised gold",
  "An issuer-backed token representing physical gold held in custody. Gold price, custody and redemption risks all matter.",
  24,
);
add(
  "0x68749665ff8d2d112fa859aa293f07a622782f38",
  "Gold",
  "Tokenised gold",
  "An issuer-backed token representing physical gold held in custody. Gold price, custody and redemption risks all matter.",
  24,
);
for (const address of [
  "0x553c7f9c780316fc1d34b8e14ac2465ab22a090b",
  "0x2e880962a9609aa3eab4def919fe9e917e99073b",
  "0x8747a3114ef7f0eebd3eb337f745e31dbf81a952",
  "0x343324f53cbeee3ee6d171f2a20f005964c98047",
])
  add(
    address,
    "Company shares",
    "Tokenised shares",
    "A tokenised ownership interest in a company. Company performance, shareholder rights and the availability of buyers affect its value.",
    72,
  );
add(
  "0xfedc5f4a6c38211c1338aa411018dfaf26612c08",
  "Equity funds",
  "Tokenised ETF exposure",
  "A token providing exposure to an S&P 500 ETF through an issuer's tokenisation structure. The underlying market and the issuer's redemption terms both matter.",
  72,
);
for (const address of ["0xd533a949740bb3306d119cc777fa900ba034cd52", "0x6810e776880c02933d47db1b9fc05908e5386b96"])
  add(
    address,
    "Other crypto",
    "Protocol token",
    "A crypto protocol token. Its market value and liquidity depend on the protocol and its token economics.",
  );
add(
  "0x23346b04a7f55b8760e5860aa5a77383d63491cd",
  "DeFi strategies",
  "Vault token",
  "A token representing a DeFi strategy. Its value depends on the underlying assets, strategy contracts and withdrawal arrangements.",
);

export function assetProfile(address: string | null, isBridge = false): AssetProfile {
  if (isBridge)
    return {
      group: "1:1 stablecoin bridge",
      underlying: "Swiss franc",
      type: "1:1 stablecoin bridge",
      description:
        "ZCHF is issued one-for-one against another CHF stablecoin held by a bridge. Exposure depends on that stablecoin's issuer, peg and redemption availability.",
      priceMaxAgeHours: 1,
    };
  return (
    profiles[address?.toLowerCase() ?? ""] ?? {
      group: "Other / unclassified",
      type: "Other / unclassified",
      underlying: "Other / unclassified",
      description:
        "An asset assessed or used as backing for collateralised ZCHF borrowing. Read the author's assessment for its ownership, backing and redemption arrangements.",
      priceMaxAgeHours: 24,
    }
  );
}
