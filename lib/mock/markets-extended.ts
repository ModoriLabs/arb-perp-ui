// TODO: Replace mock with API once extended markets backend is ready

export type ExtendedMarketCategory =
  | "major"
  | "defi"
  | "equities"
  | "index"
  | "fx"
  | "commodities"
  | "synthetics"

export interface ExtendedMarket {
  symbol: string
  name: string
  category: ExtendedMarketCategory
  price: string
  change24h: string // signed percent string, e.g. "+2.34" or "-0.45"
  volume24h: string
  available: boolean // true only for markets actually wired to the live engine
}

export interface Ecosystem {
  id: string
  name: string
  collateralToken: string
  /** OKLCH brand color for borders/accents/watermarks */
  color: string
  /** Logo path under public/. Falls back to colored dot if file is missing. */
  logo: string
  /**
   * Quote/collateral asset_id used to route to the live API market. Set only
   * for live collateral rails (ELP-133): selecting this ecosystem trades the
   * market quoted in this token.
   */
  quoteAssetId?: number
}

export const ECOSYSTEMS: Ecosystem[] = [
  {
    id: "arbitrum",
    name: "Arbitrum",
    collateralToken: "ARB",
    color: "oklch(0.70 0.16 235)",
    logo: "/icons/collateral_logos/arbitrum_logo.svg",
    quoteAssetId: 11841,
  },
  {
    id: "elysia",
    name: "Elysia",
    collateralToken: "EL",
    color: "oklch(0.77 0.15 270)",
    logo: "/icons/collateral_logos/el.svg",
    quoteAssetId: 5382,
  },
  {
    id: "usdt",
    name: "Tether",
    collateralToken: "USDT",
    color: "oklch(0.75 0.13 165)",
    logo: "/icons/tokens/usdt.svg",
    quoteAssetId: 825,
  },
  {
    id: "ethereum",
    name: "Ethereum",
    collateralToken: "ETH",
    color: "oklch(0.62 0.13 270)",
    logo: "/icons/collateral_logos/eth.svg",
  },
  {
    id: "bnb",
    name: "BNB Chain",
    collateralToken: "BNB",
    color: "oklch(0.82 0.17 85)",
    logo: "/icons/collateral_logos/bnb.png",
  },
  {
    id: "solana",
    name: "Solana",
    collateralToken: "SOL",
    color: "oklch(0.78 0.18 155)",
    logo: "/icons/collateral_logos/solana.svg",
  },
  {
    id: "optimism",
    name: "Optimism",
    collateralToken: "OP",
    color: "oklch(0.65 0.20 25)",
    logo: "/icons/collateral_logos/optimism_logo.svg",
  },
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    collateralToken: "HYPE",
    color: "oklch(0.82 0.10 195)",
    logo: "/icons/collateral_logos/hyperliquid.svg",
  },
  {
    id: "monad",
    name: "Monad",
    collateralToken: "MON",
    color: "oklch(0.65 0.18 295)",
    logo: "/icons/collateral_logos/monad.svg",
  },
]

export const DEFAULT_ECOSYSTEM_ID = "elysia"

export function getEcosystemById(id: string): Ecosystem {
  return (
    ECOSYSTEMS.find((e) => e.id === id) ??
    ECOSYSTEMS.find((e) => e.id === DEFAULT_ECOSYSTEM_ID) ??
    ECOSYSTEMS[0]
  )
}

/**
 * Reverse lookup: find the ecosystem that *owns* a given quote asset_id.
 *
 * The global ecosystem store (`useEcosystemStore`) is just a browse filter
 * for the market dropdown — it can diverge from the actually-selected
 * market (URL deep link to `/trade/BTC-PERP-ARB` while the ecosystem
 * store still says "elysia", or user picks ARB sidebar but closes the
 * dialog without choosing a market). Display strings like the
 * "Used as collateral" chip and the orderbook's quote-symbol column
 * header have to follow the *market*, not the browse filter — otherwise
 * a BTC-PERP-ARB chart reads "EL · Used as collateral" and the order
 * book column header reads "Size (EL$)" while every trade is actually
 * quoted in ARB.
 *
 * Falls back to the default ecosystem when no live rail is registered
 * for the asset — surfaces a sensible chip instead of crashing on
 * historical/exotic quote tokens.
 */
export function getEcosystemByQuoteAssetId(
  assetId: number | undefined
): Ecosystem {
  if (assetId == null) return getEcosystemById(DEFAULT_ECOSYSTEM_ID)
  return (
    ECOSYSTEMS.find((e) => e.quoteAssetId === assetId) ??
    getEcosystemById(DEFAULT_ECOSYSTEM_ID)
  )
}

export const CATEGORIES: ReadonlyArray<{
  id: ExtendedMarketCategory
  label: string
}> = [
  { id: "major", label: "Major" },
  { id: "defi", label: "DeFi" },
  { id: "equities", label: "Equities" },
  { id: "index", label: "Index" },
  { id: "fx", label: "FX" },
  { id: "commodities", label: "Commodities" },
  { id: "synthetics", label: "Synthetics" },
]

export const DEFAULT_CATEGORY: ExtendedMarketCategory = "major"

export const EXTENDED_MARKETS: ExtendedMarket[] = [
  // Major
  {
    symbol: "BTC-PERP",
    name: "Bitcoin",
    category: "major",
    price: "63,420.50",
    change24h: "+2.34",
    volume24h: "$1.24B",
    available: true,
  },
  {
    symbol: "ETH-PERP",
    name: "Ethereum",
    category: "major",
    price: "3,245.80",
    change24h: "+1.87",
    volume24h: "$842M",
    available: false,
  },
  {
    symbol: "SOL-PERP",
    name: "Solana",
    category: "major",
    price: "152.40",
    change24h: "+4.12",
    volume24h: "$418M",
    available: false,
  },
  {
    symbol: "XRP-PERP",
    name: "XRP",
    category: "major",
    price: "0.5234",
    change24h: "-0.45",
    volume24h: "$215M",
    available: false,
  },
  {
    symbol: "BNB-PERP",
    name: "BNB",
    category: "major",
    price: "612.30",
    change24h: "+0.92",
    volume24h: "$184M",
    available: false,
  },
  {
    symbol: "DOGE-PERP",
    name: "Dogecoin",
    category: "major",
    price: "0.1582",
    change24h: "-1.23",
    volume24h: "$98M",
    available: false,
  },
  {
    symbol: "TRX-PERP",
    name: "TRON",
    category: "major",
    price: "0.1432",
    change24h: "+0.34",
    volume24h: "$72M",
    available: false,
  },

  // DeFi
  {
    symbol: "UNI-PERP",
    name: "Uniswap",
    category: "defi",
    price: "9.84",
    change24h: "+1.45",
    volume24h: "$56M",
    available: false,
  },
  {
    symbol: "AAVE-PERP",
    name: "Aave",
    category: "defi",
    price: "182.50",
    change24h: "+2.78",
    volume24h: "$48M",
    available: false,
  },
  {
    symbol: "LDO-PERP",
    name: "Lido DAO",
    category: "defi",
    price: "1.92",
    change24h: "-0.85",
    volume24h: "$32M",
    available: false,
  },
  {
    symbol: "MKR-PERP",
    name: "Maker",
    category: "defi",
    price: "1,425.00",
    change24h: "+0.67",
    volume24h: "$24M",
    available: false,
  },
  {
    symbol: "CRV-PERP",
    name: "Curve DAO",
    category: "defi",
    price: "0.4856",
    change24h: "+3.12",
    volume24h: "$18M",
    available: false,
  },
  {
    symbol: "COMP-PERP",
    name: "Compound",
    category: "defi",
    price: "52.40",
    change24h: "-1.45",
    volume24h: "$12M",
    available: false,
  },

  // Equities
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    category: "equities",
    price: "227.80",
    change24h: "+0.85",
    volume24h: "$8.2B",
    available: false,
  },
  {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    category: "equities",
    price: "248.50",
    change24h: "+3.42",
    volume24h: "$14.5B",
    available: false,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    category: "equities",
    price: "138.60",
    change24h: "+2.18",
    volume24h: "$22.8B",
    available: false,
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    category: "equities",
    price: "418.30",
    change24h: "+0.42",
    volume24h: "$6.8B",
    available: false,
  },
  {
    symbol: "GOOGL",
    name: "Alphabet",
    category: "equities",
    price: "175.20",
    change24h: "+1.12",
    volume24h: "$5.4B",
    available: false,
  },
  {
    symbol: "AMZN",
    name: "Amazon",
    category: "equities",
    price: "192.80",
    change24h: "+0.78",
    volume24h: "$7.1B",
    available: false,
  },
  {
    symbol: "META",
    name: "Meta Platforms",
    category: "equities",
    price: "584.20",
    change24h: "+1.34",
    volume24h: "$4.9B",
    available: false,
  },

  // Index
  {
    symbol: "SPX",
    name: "S&P 500",
    category: "index",
    price: "5,824.40",
    change24h: "+0.62",
    volume24h: "$28.4B",
    available: false,
  },
  {
    symbol: "NDX",
    name: "Nasdaq 100",
    category: "index",
    price: "20,184.50",
    change24h: "+1.05",
    volume24h: "$18.2B",
    available: false,
  },
  {
    symbol: "DJI",
    name: "Dow Jones",
    category: "index",
    price: "42,840.20",
    change24h: "+0.34",
    volume24h: "$12.6B",
    available: false,
  },
  {
    symbol: "VIX",
    name: "CBOE Volatility",
    category: "index",
    price: "16.42",
    change24h: "-2.14",
    volume24h: "$2.4B",
    available: false,
  },
  {
    symbol: "KOSPI",
    name: "KOSPI Composite",
    category: "index",
    price: "2,580.30",
    change24h: "-0.85",
    volume24h: "$8.2B",
    available: false,
  },
  {
    symbol: "N225",
    name: "Nikkei 225",
    category: "index",
    price: "39,420.80",
    change24h: "+0.92",
    volume24h: "$10.4B",
    available: false,
  },

  // FX
  {
    symbol: "EUR-USD",
    name: "Euro / US Dollar",
    category: "fx",
    price: "1.0852",
    change24h: "+0.18",
    volume24h: "$92B",
    available: false,
  },
  {
    symbol: "GBP-USD",
    name: "British Pound / US Dollar",
    category: "fx",
    price: "1.2932",
    change24h: "-0.24",
    volume24h: "$48B",
    available: false,
  },
  {
    symbol: "USD-JPY",
    name: "US Dollar / Japanese Yen",
    category: "fx",
    price: "152.42",
    change24h: "+0.42",
    volume24h: "$76B",
    available: false,
  },
  {
    symbol: "USD-KRW",
    name: "US Dollar / Korean Won",
    category: "fx",
    price: "1,358.50",
    change24h: "+0.18",
    volume24h: "$12B",
    available: false,
  },
  {
    symbol: "USD-CNY",
    name: "US Dollar / Chinese Yuan",
    category: "fx",
    price: "7.1248",
    change24h: "-0.05",
    volume24h: "$24B",
    available: false,
  },
  {
    symbol: "AUD-USD",
    name: "Australian Dollar / US Dollar",
    category: "fx",
    price: "0.6584",
    change24h: "+0.62",
    volume24h: "$18B",
    available: false,
  },

  // Commodities
  {
    symbol: "GOLD",
    name: "Gold Spot",
    category: "commodities",
    price: "2,624.50",
    change24h: "+0.34",
    volume24h: "$48B",
    available: false,
  },
  {
    symbol: "SILVER",
    name: "Silver Spot",
    category: "commodities",
    price: "30.84",
    change24h: "+1.12",
    volume24h: "$8B",
    available: false,
  },
  {
    symbol: "OIL",
    name: "WTI Crude Oil",
    category: "commodities",
    price: "72.45",
    change24h: "-0.85",
    volume24h: "$24B",
    available: false,
  },
  {
    symbol: "NGAS",
    name: "Natural Gas",
    category: "commodities",
    price: "2.482",
    change24h: "+2.45",
    volume24h: "$4B",
    available: false,
  },
  {
    symbol: "COPPER",
    name: "Copper",
    category: "commodities",
    price: "4.245",
    change24h: "+0.62",
    volume24h: "$2B",
    available: false,
  },

  // Synthetics — Elysia originals (spread / index / ratio products)
  {
    symbol: "KIMP",
    name: "Korea Premium Index",
    category: "synthetics",
    price: "2.84",
    change24h: "+0.42",
    volume24h: "$18M",
    available: false,
  },
  {
    symbol: "JIMP",
    name: "Japan Premium Index",
    category: "synthetics",
    price: "1.62",
    change24h: "-0.18",
    volume24h: "$8M",
    available: false,
  },
  {
    symbol: "BTC.D",
    name: "Bitcoin Dominance",
    category: "synthetics",
    price: "58.42",
    change24h: "+0.34",
    volume24h: "$24M",
    available: false,
  },
  {
    symbol: "ETHBTC",
    name: "ETH / BTC Ratio",
    category: "synthetics",
    price: "0.0512",
    change24h: "-0.62",
    volume24h: "$32M",
    available: false,
  },
  {
    symbol: "ALTS",
    name: "Altcoin Index",
    category: "synthetics",
    price: "184.20",
    change24h: "+1.84",
    volume24h: "$12M",
    available: false,
  },
  {
    symbol: "DEFIIDX",
    name: "DeFi Index",
    category: "synthetics",
    price: "2,484.60",
    change24h: "+2.12",
    volume24h: "$8M",
    available: false,
  },
]
