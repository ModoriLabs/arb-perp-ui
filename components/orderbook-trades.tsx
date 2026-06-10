"use client"

import { useState } from "react"
import { OrderBook } from "@/components/order-book"
import { RecentTrades } from "@/components/recent-trades"

type Tab = "orderbook" | "trades"

export function OrderBookTrades() {
  const [tab, setTab] = useState<Tab>("orderbook")

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center bg-card">
        <div className="flex h-8 w-full overflow-auto">
          <button
            onClick={() => setTab("orderbook")}
            className={`relative h-8 min-h-8 cursor-pointer px-3 text-xs font-normal transition-all hover:text-foreground w-full min-w-20 ${
              tab === "orderbook"
                ? "bg-muted text-foreground"
                : "bg-transparent text-muted-foreground"
            }`}
          >
            Order Book
            <div
              className={`absolute inset-x-0 bottom-px m-auto block h-0.5 w-3/5 max-w-16 rounded-full bg-primary transition-all duration-300 ease-in-out ${
                tab === "orderbook"
                  ? "scale-x-100 opacity-100"
                  : "scale-x-0 opacity-0"
              }`}
            />
          </button>
          <button
            onClick={() => setTab("trades")}
            className={`relative h-8 min-h-8 cursor-pointer px-3 text-xs font-normal transition-all hover:text-foreground w-full min-w-20 ${
              tab === "trades"
                ? "bg-muted text-foreground"
                : "bg-transparent text-muted-foreground"
            }`}
          >
            Trades
            <div
              className={`absolute inset-x-0 bottom-px m-auto block h-0.5 w-3/5 max-w-16 rounded-full bg-primary transition-all duration-300 ease-in-out ${
                tab === "trades"
                  ? "scale-x-100 opacity-100"
                  : "scale-x-0 opacity-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "orderbook" ? (
          <OrderBook showHeader={false} />
        ) : (
          <RecentTrades />
        )}
      </div>
    </div>
  )
}
