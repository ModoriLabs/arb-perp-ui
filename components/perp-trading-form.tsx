"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { LeverageModal } from "@/components/trading/leverage-modal"
import { MarginModeModal } from "@/components/trading/margin-mode-modal"
import { useBalance } from "@/lib/hooks/useBalance"
import { Balance, PerpOrderType, sideToIsAsk } from "@/types"
import { useConnection } from "wagmi"
import { tradingToast } from "@/lib/utils/toast"
import { useCreatePerpOrder } from "@/lib/hooks/useCreatePerpOrder"
import { useHistoryTabStore } from "@/lib/stores"
import { useOpenPerpOrders } from "@/lib/hooks/useOpenPerpOrders"
import { useOrderBookDetails } from "@/lib/hooks/useOrderBookDetails"
import { useAccount } from "@/lib/hooks/useAccount"
import { useOrderbook } from "@/lib/hooks/useOrderbook"
import { useAuthContext } from "@/lib/providers/AuthProvider"
import { imfToLeverage } from "@/types"
import { FEE_TICK } from "@/lib/constants/scaling"
import { computeLiquidationPrice, mmfFractionOf } from "@/lib/utils/liquidation"
import {
  useSelectedPair,
  useMarketStore,
  usePositionStore,
  useCurrentMarketPosition,
  useMarkPriceStore,
  selectMarkPrice,
} from "@/lib/stores"
import { useTradingFormStore } from "@/lib/stores"

// 소수점 세 번째 자리에서 내림하여 두 번째 자리까지 표시
function formatBalance(value: number): string {
  return (Math.floor(value * 100) / 100).toFixed(2)
}

// Parse price string (remove commas) to number
function parsePriceInput(value: string): number {
  return Number.parseFloat(value || "0")
}

const orderTypeOptions: { label: string; value: PerpOrderType }[] = [
  {
    label: "Limit",
    value: "Limit",
  },
  {
    label: "Market",
    value: "Market",
  },
]

const SLIPPAGE_PRESETS = [0.1, 0.3, 0.5, 1.0]

export function PerpTradingForm() {
  const pair = useSelectedPair()
  const selectedPrice = useMarketStore((s) => s.selectedPrice)

  const baseCurrency = pair.base
  // Quote/collateral token follows the active market.
  const quoteCurrency = pair.quote

  // Derive decimal places from market scale_k (e.g. BTC: base=5, quote=1)
  const baseDecimals = useMemo(
    () => Math.round(Math.log10(pair.base_scale_k || 100000)),
    [pair.base_scale_k]
  )
  const quoteDecimals = useMemo(
    () => Math.round(Math.log10(pair.quote_scale_k || 10)),
    [pair.quote_scale_k]
  )

  // Reject input if decimal places exceed allowed limit
  const exceedsDecimals = (value: string, maxDecimals: number): boolean => {
    const parts = value.split(".")
    return parts.length >= 2 && parts[1].length > maxDecimals
  }

  const priceMaxIntDigits = useMemo(() => 10 - quoteDecimals, [quoteDecimals])

  // Extensible size unit options — "base" is always the internal unit
  const sizeUnitOptions = useMemo(
    () => [
      { value: "base", label: baseCurrency },
      { value: "quote", label: quoteCurrency },
    ],
    [baseCurrency, quoteCurrency]
  )

  // Trading form store
  const side = useTradingFormStore((s) => s.side)
  const orderType = useTradingFormStore((s) => s.orderType)
  const orderPrice = useTradingFormStore((s) => s.orderPrice)
  const amount = useTradingFormStore((s) => s.amount)
  const sliderValue = useTradingFormStore((s) => s.sliderValue)
  const leverage = useTradingFormStore((s) => s.leverage)
  const marginMode = useTradingFormStore((s) => s.marginMode)
  const reduceOnly = useTradingFormStore((s) => s.reduceOnly)
  const maxSlippage = useTradingFormStore((s) => s.maxSlippage)
  const isLeverageModalOpen = useTradingFormStore((s) => s.isLeverageModalOpen)
  const isMarginModeModalOpen = useTradingFormStore(
    (s) => s.isMarginModeModalOpen
  )

  const setSide = useTradingFormStore((s) => s.setSide)
  const setOrderType = useTradingFormStore((s) => s.setOrderType)
  const setOrderPrice = useTradingFormStore((s) => s.setOrderPrice)
  const setLeverage = useTradingFormStore((s) => s.setLeverage)
  const setMarginMode = useTradingFormStore((s) => s.setMarginMode)
  const setReduceOnly = useTradingFormStore((s) => s.setReduceOnly)
  const setMaxSlippage = useTradingFormStore((s) => s.setMaxSlippage)
  const setIsLeverageModalOpen = useTradingFormStore(
    (s) => s.setIsLeverageModalOpen
  )
  const setIsMarginModeModalOpen = useTradingFormStore(
    (s) => s.setIsMarginModeModalOpen
  )
  const handleAmountChangeAction = useTradingFormStore(
    (s) => s.handleAmountChange
  )
  const handleSliderChangeAction = useTradingFormStore(
    (s) => s.handleSliderChange
  )
  const syncOnPriceChange = useTradingFormStore((s) => s.syncOnPriceChange)
  const resetForMarketChange = useTradingFormStore(
    (s) => s.resetForMarketChange
  )

  const positions = usePositionStore((s) => s.positions)
  const currentMarketPosition = useCurrentMarketPosition(pair.name)
  const { data: balanceData, refetch: refetchBalance } = useBalance()
  const { address } = useConnection()
  const { isAuthenticated } = useAuthContext()
  const { data: openOrdersData } = useOpenPerpOrders()

  // Fetch order book details for leverage settings
  const { data: orderBookDetailsData } = useOrderBookDetails()
  const { data: accountData } = useAccount()

  // Derive per-market leverage settings
  const marketLeverageConfig = useMemo(() => {
    const detail = orderBookDetailsData?.order_book_details?.find(
      (d) => d.symbol === pair.name
    )
    const maxLeverage = detail
      ? imfToLeverage(detail.min_initial_margin_fraction)
      : 20

    // Use user's saved IMF from /account if authenticated
    const accountPosition = isAuthenticated
      ? accountData?.accounts?.[0]?.positions?.find(
          (p) => p.symbol === pair.name
        )
      : undefined
    if (accountPosition) {
      const userImfPercent = parseFloat(accountPosition.initial_margin_fraction)
      if (userImfPercent > 0) {
        return {
          defaultLeverage: Math.round(100 / userImfPercent),
          maxLeverage,
        }
      }
    }

    // Fallback to orderBookDetails default
    const defaultLeverage = detail
      ? imfToLeverage(detail.default_initial_margin_fraction)
      : 10
    return { defaultLeverage, maxLeverage }
  }, [orderBookDetailsData, accountData, pair.name, isAuthenticated])

  // Initialize leverage when the (market, account-snapshot) pair changes.
  // We must re-init when /account first arrives so the user's saved IMF
  // replaces the pre-auth fallback. Tracking the snapshot alongside the
  // market also covers logout/re-auth without resetting on plain refetches.
  const leverageInitKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (isAuthenticated && !accountData) return // wait for /account
    const accountSnapshot = accountData ? "auth" : "anon"
    const key = `${pair.name}:${accountSnapshot}`
    if (leverageInitKeyRef.current === key) return
    leverageInitKeyRef.current = key
    setLeverage(marketLeverageConfig.defaultLeverage)
  }, [
    pair.name,
    isAuthenticated,
    accountData,
    marketLeverageConfig.defaultLeverage,
    setLeverage,
  ])

  // Get mark price from store
  const storeMarkPrice = useMarkPriceStore(selectMarkPrice(pair.name))

  // Capture mark price once for display (no continuous updates)
  const initialMarkPriceRef = useRef<number | null>(null)
  const hasInitializedLimitPriceRef = useRef(false)
  const inputSourceRef = useRef<"base" | "quote">("base")
  const sourceQuoteRef = useRef("")

  // Capture initial mark price when data arrives (only once per market)
  useEffect(() => {
    if (storeMarkPrice > 0 && initialMarkPriceRef.current === null) {
      initialMarkPriceRef.current = storeMarkPrice
    }
  }, [storeMarkPrice])

  // Reset captured mark price when market changes
  useEffect(() => {
    initialMarkPriceRef.current = null
    hasInitializedLimitPriceRef.current = false
  }, [pair.name])

  // Use captured mark price for display (no 5-second auto-update)
  const markPrice = initialMarkPriceRef.current ?? storeMarkPrice

  // Parse price to number
  const priceNum = useMemo(() => parsePriceInput(orderPrice), [orderPrice])

  // Initialize limit price with mark price when switching to Limit order type
  useEffect(() => {
    if (
      orderType === "Limit" &&
      markPrice > 0 &&
      !hasInitializedLimitPriceRef.current
    ) {
      setOrderPrice(markPrice.toString())
      hasInitializedLimitPriceRef.current = true
    }
  }, [orderType, markPrice, setOrderPrice])

  // Reset initialization flag when switching away from Limit
  useEffect(() => {
    if (orderType === "Market") {
      hasInitializedLimitPriceRef.current = false
    }
  }, [orderType])

  // Display price: for Market orders use live mark price with slippage (matches backend margin lock)
  // Long: locks margin at slippage ceiling (markPrice × 1.005)
  // Short: locks margin at best_bid, but we approximate with slippage floor
  const displayPrice = useMemo(() => {
    if (orderType === "Market") {
      const slippageMultiplier =
        side === "Long" ? 1 + maxSlippage / 100 : 1 - maxSlippage / 100
      return storeMarkPrice * slippageMultiplier
    }
    return priceNum
  }, [orderType, storeMarkPrice, priceNum, side, maxSlippage])

  const hasActiveOrdersOrPositions = useMemo(() => {
    const hasPositions = positions.some((position) => {
      return position.market === pair.name
    })
    const hasOrders = openOrdersData?.orders.some((order) => {
      return order.market === pair.name
    })
    return hasPositions || hasOrders
  }, [positions, openOrdersData, pair.name])

  // Compute available balance for the active market's quote token. Multi-token
  // (ELP-133): the collateral that backs an order is the market's quote token,
  // so we match on asset_id rather than picking the first perp balance.
  const availableQuoteRaw = useMemo(() => {
    const balances = balanceData?.balances ?? []
    const quoteBalance = balances.find(
      (balance: Balance) => balance.asset_id === pair.quote_currency
    )
    return quoteBalance ? parseFloat(quoteBalance.available) : 0
  }, [balanceData, pair.quote_currency])

  const availableQuote = useMemo(
    () => formatBalance(availableQuoteRaw),
    [availableQuoteRaw]
  )

  // Calculate reduceable amount based on current position
  const reduceableAmount = useMemo(() => {
    if (currentMarketPosition) {
      return Number(currentMarketPosition.size)
    }
    return 0
  }, [currentMarketPosition])

  // Size of opposite-side position (closes without margin)
  const oppositePositionSize = useMemo(() => {
    if (currentMarketPosition && currentMarketPosition.side !== side) {
      return Number(currentMarketPosition.size)
    }
    return 0
  }, [currentMarketPosition, side])

  // Reset when pair changes — use mark price if available, otherwise empty
  useEffect(() => {
    const data = useMarkPriceStore.getState().markPrices.get(pair.name)
    const price = data?.mark_price ? parseFloat(data.mark_price) : 0
    resetForMarketChange(price > 0 ? price.toString() : "")
  }, [pair.name, resetForMarketChange])

  // Sync orderPrice from orderbook price click (price only, no amount recalc)
  const fromOrderbookRef = useRef(false)
  useEffect(() => {
    if (selectedPrice) {
      fromOrderbookRef.current = true
      setOrderPrice(selectedPrice)
    }
  }, [selectedPrice, setOrderPrice])

  // Sync slider/amount when price changes (skip if from orderbook click)
  useEffect(() => {
    if (fromOrderbookRef.current) {
      fromOrderbookRef.current = false
      return
    }
    syncOnPriceChange(availableQuoteRaw, baseDecimals)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only sync when orderPrice changes
  }, [orderPrice])

  // Recalculate slider when available balance changes (after order placed/cancelled)
  useEffect(() => {
    if (amount && displayPrice > 0) {
      handleAmountChange(amount)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only react to balance changes
  }, [availableQuoteRaw])

  // Sync between base amount and quoteInput depending on which is source of truth
  useEffect(() => {
    if (sizeUnit !== "base" && !quoteInputRef.current) {
      // Slider or external change → sync quoteInput from base amount
      syncQuoteInput(amount)
    }
  }, [amount]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sourceQuote = sourceQuoteRef.current
    if (inputSourceRef.current === "quote" && sourceQuote) {
      const quoteValue = Number.parseFloat(sourceQuote)
      if (displayPrice > 0 && quoteValue > 0) {
        handleAmountChange((quoteValue / displayPrice).toFixed(baseDecimals))
      }
    } else if (inputSourceRef.current === "base" && sizeUnit !== "base") {
      syncQuoteInput(amount)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayPrice])

  // Refetch balance when pair changes
  useEffect(() => {
    if (isAuthenticated) {
      refetchBalance()
    }
  }, [pair.id, pair.name, address, refetchBalance, isAuthenticated])

  // Adjust amount when reduceOnly changes
  useEffect(() => {
    const newAmount =
      Number(amount) > reduceableAmount ? reduceableAmount.toString() : amount
    handleAmountChangeAction(
      newAmount,
      displayPrice,
      availableQuoteRaw,
      reduceableAmount,
      oppositePositionSize
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only react to reduceOnly toggle
  }, [reduceOnly])

  const isReduceable = () => {
    if (!reduceOnly) return true
    return currentMarketPosition?.side !== side
  }

  const syncQuoteInput = (baseAmount: string) => {
    const baseNum = Number.parseFloat(baseAmount || "0")
    if (displayPrice > 0 && baseNum > 0) {
      setQuoteInput((displayPrice * baseNum).toFixed(quoteDecimals))
    } else {
      setQuoteInput("")
    }
  }

  const handleSliderChange = (value: number) => {
    inputSourceRef.current = "base"
    sourceQuoteRef.current = ""
    handleSliderChangeAction(
      value,
      displayPrice,
      availableQuoteRaw,
      reduceableAmount,
      oppositePositionSize,
      baseDecimals
    )
  }

  const handleAmountChange = (value: string) => {
    handleAmountChangeAction(
      value,
      displayPrice,
      availableQuoteRaw,
      reduceableAmount,
      oppositePositionSize
    )
  }

  // Create Order Hook
  const createOrder = useCreatePerpOrder()

  const getOrderPrice = (): string => {
    if (orderType === "Market") {
      // Use live mark price for slippage calculation, not the stale captured one
      const livePrice = useMarkPriceStore.getState().markPrices.get(pair.name)
      const currentMarkPrice = livePrice?.mark_price
        ? parseFloat(livePrice.mark_price)
        : markPrice
      const slippageMultiplier =
        side === "Long" ? 1 + maxSlippage / 100 : 1 - maxSlippage / 100
      return (currentMarkPrice * slippageMultiplier).toString()
    }
    return priceNum.toString()
  }

  const handleSubmit = () => {
    let baseAmount = Number.parseFloat(amount).toString()
    // For reduce-only: if amount >= position size, use exact position size to avoid dust
    if (
      reduceOnly &&
      reduceableAmount > 0 &&
      Number.parseFloat(amount) >= reduceableAmount
    ) {
      baseAmount = String(reduceableAmount)
    }
    const price = getOrderPrice()

    createOrder.mutate(
      {
        market: pair.name,
        side,
        is_ask: sideToIsAsk(side),
        price,
        size: baseAmount,
        base_amount: baseAmount,
        order_type: orderType === "Limit" ? 0 : 1,
        reduce_only: reduceOnly,
        margin_mode: 1,
      },
      {
        onSuccess: () => {
          // For Market orders the submitted price is the slippage ceiling
          // (mark × 1.005), not the fill price. Show live mark instead, with
          // an "≈" prefix so the user knows it's approximate.
          const livePrice = useMarkPriceStore
            .getState()
            .markPrices.get(pair.name)?.mark_price
          const liveMark = livePrice ? parseFloat(livePrice) : 0
          const isMarket = orderType === "Market"
          const toastPrice =
            isMarket && liveMark > 0 ? liveMark : Number.parseFloat(price)
          tradingToast.orderSubmitted({
            market: pair.name,
            side,
            orderType,
            size: baseAmount,
            baseCurrency,
            price: toastPrice,
            approximate: isMarket,
          })
          if (orderType === "Market") {
            useHistoryTabStore.getState().setActiveTab("positions")
          } else {
            useHistoryTabStore.getState().setActiveTab("open-orders")
          }
        },
        onError: () => {
          const livePrice = useMarkPriceStore
            .getState()
            .markPrices.get(pair.name)?.mark_price
          const liveMark = livePrice ? parseFloat(livePrice) : 0
          const isMarket = orderType === "Market"
          const toastPrice =
            isMarket && liveMark > 0 ? liveMark : Number.parseFloat(price)
          tradingToast.orderFailed({
            market: pair.name,
            side,
            orderType,
            size: baseAmount,
            baseCurrency,
            price: toastPrice,
            approximate: isMarket,
          })
        },
      }
    )
  }

  const [sizeUnit, setSizeUnit] = useState("base")
  const [quoteInput, setQuoteInput] = useState("")
  const quoteInputRef = useRef(false) // true while user is typing in non-base mode

  const sizeMaxLength = useMemo(() => {
    const config: Record<string, { base: number; quote: number }> = {
      BTC: { base: 10, quote: 12 },
      ETH: { base: 11, quote: 12 },
    }
    const marketConfig = config[pair.base]
    if (marketConfig) {
      return sizeUnit === "base" ? marketConfig.base : marketConfig.quote
    }
    return 12
  }, [pair.base, sizeUnit])

  const isBuy = side === "Long"
  const buttonClass = isBuy
    ? "w-full bg-success hover:bg-success/90 text-success-foreground"
    : "w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
  const availableBalance = availableQuote
  const availableCurrency = quoteCurrency

  // When placing an opposite-side order, the portion that closes the existing
  // position doesn't require margin — only the excess needs new margin.
  const getNetMarginRequired = (total: number) => {
    if (reduceOnly) return 0
    const isOpposite =
      currentMarketPosition && currentMarketPosition.side !== side
    if (isOpposite) {
      const closeNotional = reduceableAmount * displayPrice
      return Math.max(0, total - closeNotional)
    }
    return total
  }

  const isPlaceable = () => {
    const total = displayPrice * Number.parseFloat(amount || "0")
    if (total <= 0) return false
    if (sizeUnit !== "base") {
      const quoteValue = Number.parseFloat(quoteInput || "0")
      const minQuoteAmount = displayPrice / (pair.base_scale_k || 100000)
      if (quoteValue > 0 && quoteValue < minQuoteAmount) return false
    }
    const maxNotional = availableQuoteRaw * leverage
    const netRequired = getNetMarginRequired(total)
    // Allow small floating-point tolerance (0.01%) to avoid false "not enough margin"
    if (netRequired > maxNotional * 1.0001) return false
    if (createOrder.isPending) return false
    if (!isReduceable()) return false
    if (reduceOnly && reduceableAmount < total / displayPrice) return false
    return true
  }

  const getButtonText = () => {
    const total = displayPrice * Number.parseFloat(amount || "0")
    if (total <= 0) return "Enter Amount"
    if (sizeUnit !== "base") {
      const quoteValue = Number.parseFloat(quoteInput || "0")
      const minQuoteAmount = displayPrice / (pair.base_scale_k || 100000)
      if (quoteValue > 0 && quoteValue < minQuoteAmount) return "Enter Amount"
    }
    if (reduceOnly && reduceableAmount < total / displayPrice)
      return "Reduce Only Too Large"
    const maxNotional = availableQuoteRaw * leverage
    const netRequired = getNetMarginRequired(total)
    if (netRequired > maxNotional * 1.0001) return "Not Enough Margin"
    if (createOrder.isPending) return "Submitting..."
    if (orderType === "Limit" && (orderPrice === "" || orderPrice === null))
      return "Enter Limit Price"
    if (amount === "" || Number.parseFloat(amount) <= 0) return "Enter Amount"
    return `Place ${orderType} Order`
  }

  return (
    <div className="rounded-lg border border-border bg-card w-56 md:w-64 lg:w-72 xl:w-[320px] p-3">
      {/* Leverage and Margin Mode Selector */}
      <div className="flex gap-2 mb-2">
        {/* Leverage Selector */}
        <button
          data-testid="adjust-leverage"
          onClick={() => {
            if (isAuthenticated) setIsLeverageModalOpen(true)
          }}
          disabled={!isAuthenticated}
          className="group bg-background hover:bg-card inline-flex w-fit cursor-pointer items-center justify-center truncate rounded border text-xs/none font-medium text-foreground transition-all disabled:cursor-auto disabled:opacity-50 border-border hover:border-foreground/30 hover:bg-card active:border-foreground/30 h-8 gap-2 p-2 flex-1 border-none"
        >
          <span>{orderBookDetailsData ? `${leverage}x` : "-"}</span>
        </button>

        {/* Margin Mode Selector */}
        <button
          data-testid="adjust-margin-mode"
          onClick={() => {
            setIsMarginModeModalOpen(true)
          }}
          aria-label={`Change margin mode to ${marginMode === "Cross" ? "Isolated" : "Cross"}`}
          className="group bg-background hover:bg-card inline-flex w-fit cursor-pointer items-center justify-center truncate rounded border text-xs/none font-medium text-foreground transition-all disabled:cursor-auto disabled:opacity-50 border-border active:border-foreground/30 disabled:border-border h-8 gap-2 p-2 flex-1 border-none"
        >
          <span>{marginMode}</span>
        </button>
      </div>

      {/* Side Selector */}
      <div className="grid w-full grid-cols-2 border-b border-border">
        <button
          onClick={() => setSide("Long")}
          className={`cursor-pointer py-3 px-4 text-sm font-medium transition-colors ${
            side === "Long"
              ? "bg-success text-success-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Buy / Long
        </button>
        <button
          onClick={() => setSide("Short")}
          className={`cursor-pointer py-3 px-4 text-sm font-medium transition-colors ${
            side === "Short"
              ? "bg-destructive text-destructive-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Sell / Short
        </button>
      </div>

      {/* Order Form */}
      <div className="p-4 space-y-4">
        {/* Order Type Selector */}
        <div className="flex gap-4 text-sm">
          {orderTypeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setOrderType(option.value)}
              className={`cursor-pointer font-medium ${
                orderType === option.value
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Available Balance */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Avbl</span>
          <span className="font-mono text-foreground">
            {availableBalance} {availableCurrency}
          </span>
        </div>

        {/* Price Input (only for limit orders) */}
        {orderType === "Limit" && (
          <div className="space-y-2">
            <Label
              htmlFor="order-price"
              className="text-xs text-muted-foreground"
            >
              Price
            </Label>
            <div className="relative">
              <Input
                id="order-price"
                placeholder={`0.${"0".repeat(quoteDecimals)}`}
                value={orderPrice}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return
                  const intPart = raw.split(".")[0]
                  if (intPart.length > priceMaxIntDigits) return
                  if (exceedsDecimals(raw, quoteDecimals)) return
                  setOrderPrice(raw)
                }}
                className="pr-20 font-mono"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {/* Price is shown in USD terms, so the input is labeled USDT
                    even though the market's settlement quote token is ARB. */}
                <span className="text-xs text-muted-foreground">USDT</span>
              </div>
            </div>
          </div>
        )}

        {/* Position Size Input */}
        <div className="space-y-2">
          <Label
            htmlFor="order-amount"
            className="text-xs text-muted-foreground"
          >
            Position Size
          </Label>
          <div className="relative">
            <Input
              id="order-amount"
              autoComplete="off"
              placeholder={
                sizeUnit === "base"
                  ? `0.${"0".repeat(baseDecimals)}`
                  : `0.${"0".repeat(quoteDecimals)}`
              }
              value={sizeUnit === "base" ? amount : quoteInput}
              onFocus={() => {
                if (sizeUnit !== "base") quoteInputRef.current = true
              }}
              onBlur={() => {
                quoteInputRef.current = false
              }}
              onChange={(e) => {
                const raw = e.target.value
                if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return
                if (raw.length > sizeMaxLength) return
                if (sizeUnit === "base") {
                  if (exceedsDecimals(raw, baseDecimals)) return
                  inputSourceRef.current = "base"
                  sourceQuoteRef.current = ""
                  handleAmountChange(raw)
                } else {
                  if (exceedsDecimals(raw, quoteDecimals)) return
                  inputSourceRef.current = "quote"
                  sourceQuoteRef.current = raw
                  quoteInputRef.current = true
                  setQuoteInput(raw)
                  const quoteValue = Number.parseFloat(raw || "0")
                  if (displayPrice > 0 && quoteValue > 0) {
                    const baseValue = quoteValue / displayPrice
                    handleAmountChange(baseValue.toFixed(baseDecimals))
                  } else {
                    handleAmountChange("")
                  }
                }
              }}
              className="pr-24 font-mono"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              <select
                value={sizeUnit}
                onChange={(e) => {
                  const next = e.target.value
                  if (next === "base" && sizeUnit !== "base") {
                    const quoteValue = Number.parseFloat(quoteInput || "0")
                    const minQuoteAmount =
                      displayPrice / (pair.base_scale_k || 100000)
                    if (quoteValue > 0 && quoteValue < minQuoteAmount) {
                      handleAmountChange("")
                    }
                  } else if (next !== "base" && sizeUnit === "base") {
                    if (amount) {
                      syncQuoteInput(amount)
                    }
                  }
                  setSizeUnit(next)
                }}
                className="cursor-pointer bg-transparent text-xs text-muted-foreground outline-none"
              >
                {sizeUnitOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Slider */}
        <div className="space-y-2">
          <Slider
            value={sliderValue}
            onValueChange={handleSliderChange}
            variant={side === "Long" ? "buy" : "sell"}
            showInput={true}
          />
        </div>

        {/* Reduce Only Checkbox */}
        <label className="flex w-fit cursor-pointer items-center gap-1">
          <input
            data-testid="reduce-only-checkbox"
            className="sr-only"
            type="checkbox"
            checked={reduceOnly}
            onChange={(e) => setReduceOnly(e.target.checked)}
          />
          <span className="flex size-3.5 shrink-0 items-center justify-center rounded-sm border text-foreground transition">
            <svg
              className={`transition ${reduceOnly ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-45 opacity-0"}`}
              width="8"
              height="6"
              viewBox="0 0 8 6"
              stroke="currentColor"
              fill="none"
            >
              <path
                d="M1 3L3 5L7 1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-xs">Reduce Only</span>
        </label>

        {/* Submit Button */}
        <Button
          className={buttonClass}
          onClick={handleSubmit}
          disabled={!isPlaceable()}
        >
          {getButtonText()}
        </Button>

        {/* Order Summary */}
        <OrderSummary
          amount={amount}
          displayPrice={displayPrice}
          leverage={leverage}
          orderType={orderType}
          side={side}
          baseCurrency={baseCurrency}
          maxSlippage={maxSlippage}
          onSlippageChange={setMaxSlippage}
          availableQuoteRaw={availableQuoteRaw}
          baseDecimals={baseDecimals}
        />

        {/* Reduce Only Error Message */}
        {!isReduceable() && (
          <div className="text-xs bg-destructive/10 text-destructive rounded-sm border p-2 break-words min-w-0">
            <span>
              Reduce-only orders can only decrease an existing position. Switch
              to the opposite side.
            </span>
          </div>
        )}
      </div>

      {/* Leverage Adjustment Modal */}
      <LeverageModal
        open={isLeverageModalOpen}
        onOpenChange={setIsLeverageModalOpen}
        leverage={leverage}
        onConfirm={setLeverage}
        side={side === "Long" ? "buy" : "sell"}
        market={pair.name}
        maxLeverage={marketLeverageConfig.maxLeverage}
      />

      {/* Margin Mode Modal */}
      <MarginModeModal
        open={isMarginModeModalOpen}
        onOpenChange={setIsMarginModeModalOpen}
        marginMode={marginMode}
        onConfirm={setMarginMode}
        hasActiveOrdersOrPositions={hasActiveOrdersOrPositions}
      />
    </div>
  )
}

/**
 * Walk the orderbook to compute VWAP for a given size.
 * For Long (buy): walk asks ascending. For Short (sell): walk bids descending.
 */
function calcVwap(
  entries: { price: string; size: string }[],
  targetSize: number
): number {
  if (targetSize <= 0 || entries.length === 0) return 0
  let filled = 0
  let cost = 0
  for (const entry of entries) {
    const price = parseFloat(entry.price)
    const size = parseFloat(entry.size)
    const fill = Math.min(size, targetSize - filled)
    cost += fill * price
    filled += fill
    if (filled >= targetSize) break
  }
  return filled > 0 ? cost / filled : 0
}

function OrderSummary({
  amount,
  displayPrice,
  leverage,
  orderType,
  side,
  baseCurrency,
  maxSlippage,
  onSlippageChange,
  availableQuoteRaw,
  baseDecimals,
}: {
  amount: string
  displayPrice: number
  leverage: number
  orderType: PerpOrderType
  side: "Long" | "Short"
  baseCurrency: string
  maxSlippage: number
  onSlippageChange: (v: number) => void
  availableQuoteRaw: number
  baseDecimals: number
}) {
  const pair = useSelectedPair()
  const orderbook = useOrderbook(pair.id)
  const { data: orderBookDetailsData } = useOrderBookDetails()
  const marketDetail = orderBookDetailsData?.order_book_details?.find(
    (d) => d.symbol === pair.name
  )
  // taker/maker fee are in FEE_TICK units (1 tick = 0.0001%).
  const takerFeePercent = marketDetail
    ? (parseFloat(marketDetail.taker_fee) / FEE_TICK) * 100
    : 0
  const makerFeePercent = marketDetail
    ? (parseFloat(marketDetail.maker_fee) / FEE_TICK) * 100
    : 0
  const feeDisplay = `Taker: ${takerFeePercent.toFixed(2)}% | Maker: ${makerFeePercent.toFixed(2)}%`
  const [isSlippageOpen, setIsSlippageOpen] = useState(false)
  const [customSlippage, setCustomSlippage] = useState("")
  const slippageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isSlippageOpen) return
    const handleClick = (e: MouseEvent) => {
      if (
        slippageRef.current &&
        !slippageRef.current.contains(e.target as Node)
      ) {
        setIsSlippageOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [isSlippageOpen])

  // Renamed from `size` to avoid colliding with the `size` local declared
  // inside calcVwap — the React Compiler's scope analysis was conservatively
  // marking this dep as mutable when the names matched.
  const orderSize = Number.parseFloat(amount || "0")
  const orderValue = orderSize * displayPrice
  const positionMargin = orderValue > 0 ? orderValue / leverage : 0

  // Est. liquidation price — mirrors the backend formula so the preview
  // matches the actual position's liq price after fill. Pre-trade, the best
  // proxy for mark price is the display price (limit price for Limit orders,
  // mark × slippage for Market).
  const liqPrice = computeLiquidationPrice({
    side,
    entryPrice: displayPrice,
    size: orderSize,
    margin: positionMargin,
    markPrice: displayPrice,
    mmf: mmfFractionOf(marketDetail),
  })

  // Estimate slippage: VWAP vs best price (first level in the orderbook).
  // React 19's compiler handles memoization automatically — adding our own
  // useMemo here triggered "Existing memoization could not be preserved"
  // because the compiler couldn't reason about whether orderSize would be
  // mutated later (it isn't, but the static analysis can't tell).
  const estSlippage = (() => {
    if (orderType !== "Market" || orderSize <= 0 || !orderbook.data) return 0
    const entries =
      side === "Long"
        ? (orderbook.data.asks ?? [])
        : (orderbook.data.bids ?? [])
    if (entries.length === 0) return 0
    const bestPrice = parseFloat(entries[0].price)
    if (bestPrice <= 0) return 0
    const vwap = calcVwap(entries, orderSize)
    if (vwap <= 0) return 0
    return Math.abs(((vwap - bestPrice) / bestPrice) * 100)
  })()

  const fmt = (v: number, decimals = 2) =>
    v > 0
      ? v.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : "-"

  const fmtUsd = (v: number) => (v > 0 ? `$${fmt(v)}` : "-")

  const handleCustomSlippage = () => {
    const val = parseFloat(customSlippage)
    if (val > 0 && val <= 50) {
      onSlippageChange(val)
      setIsSlippageOpen(false)
      setCustomSlippage("")
    }
  }

  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-3">
      {orderType === "Limit" && (
        <SummaryRow
          label="Maximum Order Value"
          value={fmtUsd(availableQuoteRaw * leverage)}
        />
      )}
      <SummaryRow
        label="Order Size"
        value={
          orderSize > 0
            ? `${fmt(orderSize, baseDecimals)} ${baseCurrency}`
            : "-"
        }
      />
      <SummaryRow label="Order Value" value={fmtUsd(orderValue)} />
      <SummaryRow
        label="Est. Liq. Price"
        value={liqPrice > 0 ? fmtUsd(liqPrice) : "-"}
      />
      <SummaryRow label="Position Margin" value={fmtUsd(positionMargin)} />

      {/* Slippage row with edit toggle (Market orders only) */}
      {orderType === "Market" && (
        <div ref={slippageRef}>
          <div className="flex w-full justify-between items-center">
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              Slippage
            </span>
            <button
              type="button"
              onClick={() => setIsSlippageOpen(!isSlippageOpen)}
              className="inline-flex items-center gap-1 text-xs tabular-nums text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              <span>
                Est: {estSlippage.toFixed(2)}% | Max: {maxSlippage}%
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>

          {/* Slippage editor */}
          {isSlippageOpen && (
            <div className="flex flex-col gap-2 rounded border border-border bg-background p-2">
              <div className="flex gap-1">
                {SLIPPAGE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      onSlippageChange(preset)
                      setIsSlippageOpen(false)
                    }}
                    className={`flex-1 rounded px-1.5 py-1 text-[11px] tabular-nums transition-colors ${
                      maxSlippage === preset
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  type="number"
                  placeholder="Custom %"
                  value={customSlippage}
                  onChange={(e) => setCustomSlippage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCustomSlippage()}
                  className="flex-1 rounded border border-border bg-transparent px-2 py-1 text-xs tabular-nums outline-none focus:border-primary"
                  min="0.01"
                  max="50"
                  step="0.1"
                />
                <button
                  type="button"
                  onClick={handleCustomSlippage}
                  className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Set
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <SummaryRow label="Fees" value={feeDisplay} />
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-full justify-between">
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {label}
      </span>
      <span className="text-xs tabular-nums text-foreground">{value}</span>
    </div>
  )
}
