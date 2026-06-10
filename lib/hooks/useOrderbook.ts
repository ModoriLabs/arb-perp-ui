"use client"

import { useEffect, useCallback, useSyncExternalStore } from "react"
import { useWebSocket } from "@/lib/providers/WebSocketProvider"
import type { Orderbook, OrderEntry } from "@/types"

interface WsLevel {
  price: string
  size: string
}

interface OrderbookMessage {
  channel: string
  type: "subscribed/order_book" | "update/order_book"
  data: {
    market_id: number
    bids: WsLevel[]
    asks: WsLevel[]
    timestamp: number
  }
}

// ── Shared module-level orderbook cache ──
// All useOrderbook(marketId) instances share the same data per marketId.

interface OrderbookCache {
  bids: Map<string, OrderEntry>
  asks: Map<string, OrderEntry>
  snapshot: Orderbook | null
  version: number
  subscribers: number
  unsubscribeWs: (() => void) | null
  listeners: Set<() => void>
}

const cacheMap = new Map<number, OrderbookCache>()

function getCache(marketId: number): OrderbookCache {
  let cache = cacheMap.get(marketId)
  if (!cache) {
    cache = {
      bids: new Map(),
      asks: new Map(),
      snapshot: null,
      version: 0,
      subscribers: 0,
      unsubscribeWs: null,
      listeners: new Set(),
    }
    cacheMap.set(marketId, cache)
  }
  return cache
}

const MAX_LEVELS = 50 // Only keep top N levels per side

function buildSnapshot(cache: OrderbookCache): Orderbook {
  const bids = Array.from(cache.bids.values()).sort(
    (a, b) => parseFloat(b.price) - parseFloat(a.price)
  )
  const asks = Array.from(cache.asks.values()).sort(
    (a, b) => parseFloat(a.price) - parseFloat(b.price)
  )

  // Remove only the exact crossed levels (bid price that equals or exceeds best ask)
  // This is less aggressive than midPrice filtering — only removes the overlapping levels
  if (bids.length > 0 && asks.length > 0) {
    const bestAsk = parseFloat(asks[0].price)
    const bestBid = parseFloat(bids[0].price)
    if (bestBid >= bestAsk) {
      const filteredBids = bids.filter((b) => parseFloat(b.price) < bestAsk)
      return {
        bids: filteredBids.slice(0, MAX_LEVELS),
        asks: asks.slice(0, MAX_LEVELS),
      }
    }
  }

  const result = {
    bids: bids.slice(0, MAX_LEVELS),
    asks: asks.slice(0, MAX_LEVELS),
  }

  // Trim far-away levels from the Map to prevent unbounded growth (after building result)
  if (cache.bids.size > MAX_LEVELS * 2) {
    const keepBids = new Set(result.bids.map((b) => b.price))
    for (const key of cache.bids.keys()) {
      if (!keepBids.has(key)) cache.bids.delete(key)
    }
  }
  if (cache.asks.size > MAX_LEVELS * 2) {
    const keepAsks = new Set(result.asks.map((a) => a.price))
    for (const key of cache.asks.keys()) {
      if (!keepAsks.has(key)) cache.asks.delete(key)
    }
  }

  return result
}

const throttleTimers = new Map<number, ReturnType<typeof setTimeout>>()
const lastNotify = new Map<number, number>()
const THROTTLE_MS = 100 // Max 10 updates/sec

function notifyListeners(cache: OrderbookCache, marketId?: number) {
  const key = marketId ?? 0
  const now = Date.now()
  const last = lastNotify.get(key) ?? 0

  // If enough time passed, notify immediately (leading edge)
  if (now - last >= THROTTLE_MS) {
    lastNotify.set(key, now)
    if (throttleTimers.has(key)) {
      clearTimeout(throttleTimers.get(key))
      throttleTimers.delete(key)
    }
    cache.version++
    cache.snapshot = buildSnapshot(cache)
    for (const listener of cache.listeners) {
      listener()
    }
    return
  }

  // Otherwise schedule trailing edge
  if (throttleTimers.has(key)) return
  throttleTimers.set(
    key,
    setTimeout(
      () => {
        throttleTimers.delete(key)
        lastNotify.set(key, Date.now())
        cache.version++
        cache.snapshot = buildSnapshot(cache)
        for (const listener of cache.listeners) {
          listener()
        }
      },
      THROTTLE_MS - (now - last)
    )
  )
}

function applySnapshot(cache: OrderbookCache, msg: OrderbookMessage) {
  // Only clear a side if the snapshot has data for it — prevents wiping one side
  if (msg.data.bids.length > 0) {
    cache.bids.clear()
    for (const level of msg.data.bids) {
      cache.bids.set(level.price, {
        price: level.price,
        size: level.size,
        orders: "1",
      })
    }
  }
  if (msg.data.asks.length > 0) {
    cache.asks.clear()
    for (const level of msg.data.asks) {
      cache.asks.set(level.price, {
        price: level.price,
        size: level.size,
        orders: "1",
      })
    }
  }
}

function applyDelta(cache: OrderbookCache, msg: OrderbookMessage) {
  for (const level of msg.data.bids) {
    if (parseFloat(level.size) === 0) cache.bids.delete(level.price)
    else
      cache.bids.set(level.price, {
        price: level.price,
        size: level.size,
        orders: "1",
      })
  }
  for (const level of msg.data.asks) {
    if (parseFloat(level.size) === 0) cache.asks.delete(level.price)
    else
      cache.asks.set(level.price, {
        price: level.price,
        size: level.size,
        orders: "1",
      })
  }
}

export function useOrderbook(marketId: number) {
  const { subscribe, isConnected } = useWebSocket()
  const useWs = isConnected

  const cache = getCache(marketId)

  // Subscribe to cache changes via useSyncExternalStore
  const snapshot = useSyncExternalStore(
    useCallback(
      (onStoreChange: () => void) => {
        cache.listeners.add(onStoreChange)
        return () => {
          cache.listeners.delete(onStoreChange)
        }
      },
      [cache]
    ),
    () => cache.snapshot,
    () => cache.snapshot
  )

  // WS subscription — one shared handler per marketId (ref-counted)
  useEffect(() => {
    if (!useWs || marketId <= 0) return

    const c = getCache(marketId)
    c.subscribers++

    // Only subscribe on first instance
    if (c.subscribers === 1) {
      const channel = `order_book/${marketId}`
      c.unsubscribeWs = subscribe(channel, (raw: unknown) => {
        const msg = raw as OrderbookMessage
        const cc = getCache(marketId)

        if (msg.type === "subscribed/order_book") {
          if (msg.data.bids.length > 0 || msg.data.asks.length > 0) {
            applySnapshot(cc, msg)
            cc.version++
            cc.snapshot = buildSnapshot(cc)
            for (const l of cc.listeners) l()
          }
        } else if (msg.type === "update/order_book") {
          applyDelta(cc, msg)
          notifyListeners(cc, marketId)
        }
      })
    }

    return () => {
      const c = getCache(marketId)
      c.subscribers--
      if (c.subscribers === 0) {
        if (c.unsubscribeWs) {
          c.unsubscribeWs()
          c.unsubscribeWs = null
        }
        // Clean up module-level maps to prevent memory leak
        cacheMap.delete(marketId)
        throttleTimers.delete(marketId)
        lastNotify.delete(marketId)
      }
    }
  }, [marketId, useWs, subscribe])

  return {
    data: snapshot ?? undefined,
    isLoading: false,
    error: null,
  }
}
