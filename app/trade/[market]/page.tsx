"use client"

import { lazy, Suspense, useState } from "react"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { OrderBookTrades } from "@/components/orderbook-trades"
import { ChartSection } from "@/components/chart-section"
import { PerpTradingForm } from "@/components/perp-trading-form"
import { TradingFormDrawer } from "@/components/modals/TradingFormDrawer"
import { useMarketSync } from "@/lib/hooks/useMarketSync"
import { usePositionSync } from "@/lib/hooks/usePositionSync"
import { useMarkPriceSync } from "@/lib/hooks/useMarkPriceSync"
import { useAccountSync } from "@/lib/hooks/useAccountSync"
import { useOpenPerpOrdersSync } from "@/lib/hooks/useOpenPerpOrders"
import { useUrlMarketSync } from "@/lib/hooks/useUrlMarketSync"
import { HistorySection } from "@/components/history-section"
import { useDevModeStore } from "@/lib/stores/useDevModeStore"
import { useTradingFormStore } from "@/lib/stores"

const DataCheckPanel = lazy(() =>
  import("@/components/dev/data-check-panel").then((m) => ({
    default: m.DataCheckPanel,
  }))
)

export default function TradeMarketPage() {
  // URL is the source of truth for the selected market. `useUrlMarketSync`
  // pushes `params.market` into the Zustand market store; the rest of the
  // page reads from the store as before, so no other component had to
  // change to support deep-linkable URLs.
  const params = useParams<{ market: string }>()
  useUrlMarketSync(params.market)

  const { isLoading, isError, refetch } = useMarketSync()
  usePositionSync()
  useMarkPriceSync()
  useAccountSync()
  useOpenPerpOrdersSync()
  const dataCheckEnabled = useDevModeStore((s) => s.dataCheckEnabled)
  const setSide = useTradingFormStore((s) => s.setSide)
  const [tradingDrawerOpen, setTradingDrawerOpen] = useState(false)

  const openBuyDrawer = () => {
    setSide("Long")
    setTradingDrawerOpen(true)
  }
  const openSellDrawer = () => {
    setSide("Short")
    setTradingDrawerOpen(true)
  }

  // Error: we *had* a chance to fetch markets and it failed (and we have
  // no cached pairs to fall back on). Show an actionable affordance — a
  // permanently-spinning loader looks indistinguishable from a broken app
  // and there's nothing useful to render until the backend responds.
  if (isError) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center">
          <h2 className="text-base font-semibold text-foreground">
            Couldn’t load markets
          </h2>
          <p className="text-xs text-muted-foreground">
            The market list didn’t come back. Try again in a moment.
          </p>
          <button
            onClick={() => refetch()}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            Retry
          </button>
        </div>
      </main>
    )
  }

  // Loading: first fetch (no cache yet). Make the affordance prominent
  // enough that it can't be mistaken for a blank page on a dark theme —
  // earlier the spinner was a 4×4 muted-foreground dot on a near-black
  // background which read as "screen broken" to users.
  if (isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm">Loading markets…</span>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-0 flex-1 gap-3 p-3 pb-20 min-[851px]:pb-3">
      {/* Chart and Trading Form - Left Side */}
      <div className="flex min-h-0 min-w-0 flex-col flex-1 gap-3">
        <div className="flex flex-col min-[851px]:flex-row flex-2 gap-3 min-w-0 min-h-0">
          {dataCheckEnabled ? (
            <>
              {/* 왼쪽: 차트(WS) + 오더북(WS) */}
              <div className="flex flex-1 gap-2 min-w-0 min-h-0">
                <ChartSection label="WS" />
                <div className="w-72 shrink-0 min-h-0">
                  <OrderBookTrades />
                </div>
              </div>
              {/* 오른쪽: 차트(REST) + 오더북(REST) */}
              <div className="flex flex-1 gap-2 min-w-0 min-h-0">
                <ChartSection label="REST" dataSource="rest" />
                <div className="w-72 shrink-0">
                  <Suspense
                    fallback={
                      <div className="flex h-full items-center justify-center rounded-lg bg-card text-xs text-muted-foreground">
                        Loading...
                      </div>
                    }
                  >
                    <DataCheckPanel />
                  </Suspense>
                </div>
              </div>
            </>
          ) : (
            <>
              <ChartSection />
              <div className="hidden min-[851px]:block w-56 md:w-64 lg:w-72 xl:w-80 shrink-0 min-h-0 h-full">
                <OrderBookTrades />
              </div>
            </>
          )}
        </div>
        <div className="flex min-h-0 flex-1 gap-3 max-h-[480px]">
          <HistorySection />
        </div>
      </div>
      <div className="hidden min-[851px]:block shrink-0">
        <PerpTradingForm />
      </div>

      {/* Mobile/narrow: sticky Buy/Sell buttons + drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex gap-2 border-t border-border bg-card p-2 min-[851px]:hidden">
        <button
          onClick={openBuyDrawer}
          className="flex-1 rounded-md bg-success py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Buy / Long
        </button>
        <button
          onClick={openSellDrawer}
          className="flex-1 rounded-md bg-destructive py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Sell / Short
        </button>
      </div>

      <TradingFormDrawer
        open={tradingDrawerOpen}
        onOpenChange={setTradingDrawerOpen}
      />
    </main>
  )
}
