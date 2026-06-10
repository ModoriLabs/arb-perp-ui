"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useMarketStore, useSelectedPair } from "@/lib/stores"
import { useEcosystemStore } from "@/lib/stores/useEcosystemStore"
import { useMarkPriceStore } from "@/lib/stores/useMarkPriceStore"
import { useMediaQuery } from "@/lib/hooks/useMediaQuery"
import { formatPrice, formatUsdCompact } from "@/lib/utils/format"
import { EcosystemLogo } from "@/components/trading/ecosystem-logo"
import {
  CATEGORIES,
  DEFAULT_CATEGORY,
  ECOSYSTEMS,
  EXTENDED_MARKETS,
  getEcosystemById,
  type Ecosystem,
  type ExtendedMarketCategory,
} from "@/lib/mock/markets-extended"
import { tradingToast } from "@/lib/utils/toast"

interface MarketSelectorDialogProps {
  trigger: React.ReactNode
}

function EcosystemWatermark({ ecosystem }: { ecosystem: Ecosystem }) {
  const [errored, setErrored] = useState(false)
  if (errored) return null
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <Image
        src={ecosystem.logo}
        alt=""
        width={320}
        height={320}
        className="opacity-[0.12]"
        onError={() => setErrored(true)}
      />
    </div>
  )
}

export function MarketSelectorDialog({ trigger }: MarketSelectorDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [category, setCategory] =
    useState<ExtendedMarketCategory>(DEFAULT_CATEGORY)
  const [search, setSearch] = useState("")

  const ecosystemId = useEcosystemStore((s) => s.selectedId)
  const setEcosystemId = useEcosystemStore((s) => s.setSelectedId)
  const ecosystem = getEcosystemById(ecosystemId)

  const selectedPair = useSelectedPair()
  const pairs = useMarketStore((s) => s.pairs)

  const visibleMarkets = useMemo(() => {
    const term = search.trim().toLowerCase()
    return EXTENDED_MARKETS.filter((m) => {
      if (m.category !== category) return false
      if (!term) return true
      return (
        m.symbol.toLowerCase().includes(term) ||
        m.name.toLowerCase().includes(term)
      )
    })
  }, [category, search])

  // A collateral rail is "live" when it maps to a quote asset_id (ELP-133):
  // currently Elysia (EL) and Tether (USDT). Other ecosystems show "Soon".
  const quoteAssetId = ecosystem.quoteAssetId

  // Resolve the API pair for a market row under the selected collateral, i.e.
  // matching base asset + the ecosystem's quote token (EL → BTC-PERP,
  // USDT → BTC-PERP-USDT).
  const resolvePair = (symbol: string) => {
    if (quoteAssetId == null) return undefined
    const base = symbol.split("-")[0].toUpperCase()
    return pairs.find(
      (p) => p.base.toUpperCase() === base && p.quote_currency === quoteAssetId
    )
  }

  const handleSelect = (symbol: string) => {
    const market = EXTENDED_MARKETS.find((m) => m.symbol === symbol)
    if (!market) return

    if (market.available) {
      const found = resolvePair(symbol)
      if (found) {
        // URL is the source of truth — `useUrlMarketSync` on the trade
        // page picks up the new `[market]` segment and updates the
        // Zustand store. Doing it via router means deep links and the
        // address bar stay consistent.
        //
        // We use `replace` rather than `push` so picking a different
        // market doesn't grow the browser history (matches Binance et al.).
        // Reasoning: when a trader flips through five markets looking for
        // an entry, none of those intermediate views are an interesting
        // place to land via Back — the user almost always wants Back to
        // mean "exit trade view" (return to /pools, /stats, the previous
        // tab, etc.), not "rewind to the last symbol I glanced at". Deep
        // links (typing in the address bar / following a shared URL) still
        // produce a real history entry because that's a regular
        // navigation; only intra-trade market switches are collapsed.
        router.replace(`/trade/${found.name}`)
        setOpen(false)
        return
      }
    }

    tradingToast.info(
      "Coming soon",
      `${market.symbol} is not yet live on ${ecosystem.collateralToken} collateral.`
    )
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearch("")
      setCategory(DEFAULT_CATEGORY)
    }
    setOpen(next)
  }

  const isNarrow = useMediaQuery("(max-width: 850px)")
  const markPrices = useMarkPriceStore((s) => s.markPrices)

  const body = (
    <SelectorBody
      ecosystem={ecosystem}
      ecosystemId={ecosystemId}
      setEcosystemId={setEcosystemId}
      category={category}
      setCategory={setCategory}
      search={search}
      setSearch={setSearch}
      visibleMarkets={visibleMarkets}
      resolvePair={resolvePair}
      selectedPairId={selectedPair.id}
      onSelect={handleSelect}
      markPrices={markPrices}
    />
  )

  if (isNarrow) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[90vh] flex-col overflow-hidden rounded-t-xl border-t border-border bg-popover shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
            aria-describedby={undefined}
          >
            <DialogPrimitive.Title className="sr-only">
              Select Market
            </DialogPrimitive.Title>
            <div className="relative flex shrink-0 items-center justify-center px-4 pb-2 pt-3">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              <DialogPrimitive.Close
                aria-label="Close"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>
            <div className="min-h-0 flex-1">{body}</div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    )
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        className="w-[880px] gap-0 overflow-hidden rounded-lg border border-border bg-popover p-0 shadow-xl"
      >
        {body}
      </PopoverContent>
    </Popover>
  )
}

interface SelectorBodyProps {
  ecosystem: Ecosystem
  ecosystemId: string
  setEcosystemId: (id: string) => void
  category: ExtendedMarketCategory
  setCategory: (c: ExtendedMarketCategory) => void
  search: string
  setSearch: (s: string) => void
  visibleMarkets: typeof EXTENDED_MARKETS
  resolvePair: (symbol: string) => import("@/types").Pair | undefined
  selectedPairId: number
  onSelect: (symbol: string) => void
  markPrices: Map<string, import("@/types").MarkPriceResponse>
}

function SelectorBody({
  ecosystem,
  ecosystemId,
  setEcosystemId,
  category,
  setCategory,
  search,
  setSearch,
  visibleMarkets,
  resolvePair,
  selectedPairId,
  onSelect,
  markPrices,
}: SelectorBodyProps) {
  return (
    <div className="flex h-[520px] max-h-full min-w-0 min-[851px]:h-[520px] max-[850px]:h-[75vh]">
      {/* Ecosystem sidebar */}
      <aside className="flex w-44 shrink-0 flex-col border-r border-border bg-card max-[850px]:w-28 max-[500px]:w-12">
        <div className="border-b border-border px-3 pb-2 pt-3 max-[500px]:hidden">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ecosystem
          </div>
          <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground/70">
            Used as collateral
          </div>
        </div>
        <ul className="flex flex-col overflow-y-auto">
          {ECOSYSTEMS.map((eco) => {
            const isActive = eco.id === ecosystemId
            return (
              <li key={eco.id}>
                <button
                  onClick={() => setEcosystemId(eco.id)}
                  title={eco.name}
                  className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors max-[500px]:justify-center max-[500px]:px-1 ${
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <EcosystemLogo ecosystem={eco} size={16} />
                  <span className="flex-1 text-left max-[500px]:hidden">
                    {eco.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground max-[850px]:hidden">
                    {eco.collateralToken}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      {/* Right pane: search + categories + market list */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search markets…"
              className="h-8 w-full rounded-md border border-border bg-transparent pl-7 pr-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3">
          {CATEGORIES.map((cat) => {
            const isActive = cat.id === category
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`relative h-9 shrink-0 cursor-pointer px-3 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat.label}
                {isActive && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>

        {/* Watermark — ecosystem logo behind the market list */}
        <EcosystemWatermark ecosystem={ecosystem} />

        <div className="relative flex-1 overflow-y-auto">
          <div className="grid grid-cols-[minmax(0,1fr)_120px_90px_120px] gap-2 border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-[850px]:grid-cols-[minmax(0,1fr)_80px_60px] max-[500px]:gap-1 max-[500px]:px-2">
            <span>Symbol</span>
            <span className="text-right">Price</span>
            <span className="text-right">24h</span>
            <span className="text-right max-[850px]:hidden">Volume</span>
          </div>

          {visibleMarkets.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              No markets in this category
            </div>
          ) : (
            visibleMarkets.map((m) => {
              // Resolve the API pair for this row under the selected collateral.
              const resolved = resolvePair(m.symbol)
              const isLive = m.available && resolved != null
              const live =
                isLive && resolved ? markPrices.get(resolved.name) : undefined
              const liveChange = live?.daily_change
                ? parseFloat(live.daily_change)
                : null
              const liveVolume = live?.daily_volume
                ? parseFloat(live.daily_volume)
                : null
              const displayPrice = live?.mark_price
                ? formatPrice(parseFloat(live.mark_price))
                : m.price
              const displayChange =
                liveChange != null
                  ? `${liveChange >= 0 ? "+" : ""}${liveChange.toFixed(2)}`
                  : m.change24h
              const displayVolume =
                liveVolume != null ? formatUsdCompact(liveVolume) : m.volume24h
              const isPositive = !displayChange.startsWith("-")
              const isCurrent =
                resolved != null && resolved.id === selectedPairId
              return (
                <button
                  key={m.symbol}
                  onClick={() => onSelect(m.symbol)}
                  className={`grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_120px_90px_120px] items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 max-[850px]:grid-cols-[minmax(0,1fr)_80px_60px] max-[500px]:gap-1 max-[500px]:px-2 ${
                    isLive ? "" : "opacity-60"
                  } ${isCurrent ? "bg-muted/30" : ""}`}
                >
                  <span className="flex items-center gap-2 text-left">
                    <span className="font-medium">{m.symbol}</span>
                    <span className="truncate text-xs text-muted-foreground max-[850px]:hidden">
                      {m.name}
                    </span>
                    {!isLive && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Soon
                      </span>
                    )}
                    {isCurrent && (
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Live
                      </span>
                    )}
                  </span>
                  <span className="text-right tabular-nums">
                    {displayPrice}
                  </span>
                  <span
                    className={`text-right tabular-nums ${
                      isPositive ? "text-success" : "text-destructive"
                    }`}
                  >
                    {displayChange}%
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground max-[850px]:hidden">
                    {displayVolume}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
