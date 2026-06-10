"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useMarketStore } from "@/lib/stores/useMarketStore"
import { tradingToast } from "@/lib/utils/toast"

const LAST_MARKET_KEY = "ee.lastMarket"
export const DEFAULT_MARKET = "BTC-PERP-EL"

/**
 * Read the last-visited market name from localStorage. Used by the root
 * redirect (`/` → `/trade/<market>`) so revisiting the app lands on
 * whatever the user was last looking at instead of always resetting to
 * the global default.
 *
 * Falls back to {@link DEFAULT_MARKET} when:
 *  - running on the server (no `localStorage`),
 *  - storage is disabled (private browsing / quota),
 *  - or there's no prior value yet.
 */
export function getLastVisitedMarket(): string {
  if (typeof window === "undefined") return DEFAULT_MARKET
  try {
    return localStorage.getItem(LAST_MARKET_KEY) || DEFAULT_MARKET
  } catch {
    return DEFAULT_MARKET
  }
}

function persistLastVisited(name: string) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LAST_MARKET_KEY, name)
  } catch {
    /* storage disabled — silently ignore */
  }
}

/**
 * Sync the URL param `[market]` into the Zustand market store.
 *
 * Source of truth is the URL: when the route changes, this hook finds the
 * matching pair in the store and calls `setSelectedPairId`. We *don't* go
 * the other direction in here — that responsibility lives in the market
 * selector, which calls `router.push("/trade/<name>")` and lets the URL
 * change flow back through this hook. Single direction avoids the
 * URL↔store feedback loop.
 *
 * Behaviour:
 *  - Waits until the markets list has actually loaded (`pairs.length > 1`
 *    — until then there's only the placeholder `DEFAULT_PAIR` in the
 *    store, which won't match any real market name).
 *  - If the URL market exists → set it as selected + persist for the next
 *    visit's root redirect.
 *  - If the URL market doesn't exist (typo, deleted market, old bookmark)
 *    → toast + `router.replace` to the global default. Replace instead of
 *    push so the broken URL doesn't sit in the back/forward history.
 */
export function useUrlMarketSync(urlMarket: string) {
  const router = useRouter()
  const pairs = useMarketStore((s) => s.pairs)
  const setSelectedPairId = useMarketStore((s) => s.setSelectedPairId)

  useEffect(() => {
    // Markets haven't loaded yet — the store still has the single
    // placeholder pair. Wait for the real fetch to land.
    if (pairs.length <= 1) return

    const target = pairs.find((p) => p.name === urlMarket)
    if (target) {
      setSelectedPairId(target.id)
      persistLastVisited(urlMarket)
      return
    }

    // URL points at a market that doesn't exist (renamed, removed, typo).
    // Bounce to the global default and surface the situation so the user
    // doesn't silently end up on a different chart than they bookmarked.
    const fallback =
      pairs.find((p) => p.name === DEFAULT_MARKET)?.name ?? pairs[0]?.name
    if (!fallback) return

    tradingToast.info(
      "Market not found",
      `"${urlMarket}" isn't available — showing ${fallback} instead.`
    )
    router.replace(`/trade/${fallback}`)
  }, [urlMarket, pairs, setSelectedPairId, router])
}
