"use client"

import {
  useState,
  useMemo,
  useCallback,
  useEffect,
  startTransition,
} from "react"
import { useReadContract } from "wagmi"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
  ASSET_ID_TO_CHAIN_ID,
  getTokenAddress,
} from "@/lib/contracts/addresses"
import { MockTokenAbi } from "@/lib/contracts/abi/MockTokenAbi"
import { useBalance } from "@/lib/hooks/useBalance"
import { useWithdraw } from "@/lib/hooks/useWithdraw"
import { tradingToast } from "@/lib/utils/toast"
import { useHistoryTabStore } from "@/lib/stores"
import { TokenSelect } from "@/components/trading/token-select"
import { ASSET_IDS } from "@/lib/constants/assets"
import { getAssetName } from "@/lib/utils"

interface WithdrawModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: `0x${string}`
}

export function WithdrawModal({
  open,
  onOpenChange,
  address,
}: WithdrawModalProps) {
  const [amount, setAmount] = useState("")
  const [selectedAssetId, setSelectedAssetId] = useState<number>(ASSET_IDS.EL)
  const setActiveTab = useHistoryTabStore((s) => s.setActiveTab)

  // --- Read: perp balance from API ---
  const { data: balanceData } = useBalance()

  // Tokens the account holds — the user picks which one to withdraw (ELP-133).
  const tokenIds = useMemo(
    () => balanceData?.balances?.map((b) => b.asset_id) ?? [],
    [balanceData]
  )
  // Keep the selection valid once balances arrive.
  useEffect(() => {
    if (tokenIds.length && !tokenIds.includes(selectedAssetId)) {
      setSelectedAssetId(tokenIds[0])
    }
  }, [tokenIds, selectedAssetId])
  const tokenSymbol = getAssetName(selectedAssetId)

  // The on-chain wallet balance lives on whichever chain owns this token —
  // ARB lives on Arbitrum Sepolia, EL/USDT on Sepolia. We don't *need* the
  // value here; we just need a refetch handle to nudge the header pill
  // after the server reports a successful withdrawal.
  const tokenChainId = ASSET_ID_TO_CHAIN_ID[selectedAssetId] ?? undefined
  const tokenAddress = tokenChainId
    ? getTokenAddress(tokenChainId, selectedAssetId)
    : undefined

  const { refetch: refetchWalletBalance } = useReadContract({
    address: tokenAddress,
    abi: MockTokenAbi,
    functionName: "balanceOf",
    args: [address],
    chainId: tokenChainId,
    query: { enabled: !!address && !!tokenAddress },
  })

  // --- Withdraw mutation (API call) ---
  const {
    mutate: withdraw,
    isPending: isWithdrawPending,
    isSuccess: isWithdrawSuccess,
    error: withdrawError,
    reset: resetWithdraw,
  } = useWithdraw()

  // --- Computed values ---
  const perpAvailable = useMemo(() => {
    const balance = balanceData?.balances?.find(
      (b) => b.asset_id === selectedAssetId
    )
    return balance ? parseFloat(balance.available) : 0
  }, [balanceData, selectedAssetId])

  const formattedPerpBalance = useMemo(() => {
    return (Math.floor(perpAvailable * 100) / 100).toFixed(2)
  }, [perpAvailable])

  const parsedAmount = useMemo(() => {
    if (!amount || isNaN(Number(amount))) return null
    const num = parseFloat(amount)
    if (num <= 0) return null
    return num
  }, [amount])

  const isInsufficientBalance = useMemo(() => {
    if (parsedAmount == null) return false
    return parsedAmount > perpAvailable
  }, [parsedAmount, perpAvailable])

  const isValidAmount = useMemo(() => {
    return parsedAmount != null && parsedAmount > 0
  }, [parsedAmount])

  // --- Input handler ---
  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value

      if (value === "") {
        setAmount("")
        return
      }

      if (!/^\d*\.?\d*$/.test(value)) return

      // Prevent leading zeros (allow "0" and "0.xxx" only)
      if (value.length > 1 && value[0] === "0" && value[1] !== ".") return

      // Limit decimal places to 6
      const dotIndex = value.indexOf(".")
      if (dotIndex !== -1) {
        const decimalPart = value.slice(dotIndex + 1)
        if (decimalPart.length > 6) return
      }

      setAmount(value)
    },
    []
  )

  const handleMax = useCallback(() => {
    if (perpAvailable <= 0) return
    const raw = perpAvailable.toString()
    const dotIdx = raw.indexOf(".")
    const truncated = dotIdx === -1 ? raw : raw.slice(0, dotIdx + 7)
    setAmount(truncated)
  }, [perpAvailable])

  // --- Withdraw action (API call) ---
  const handleWithdraw = useCallback(() => {
    if (!isValidAmount) return

    withdraw(
      { asset_id: selectedAssetId, amount },
      {
        onSuccess: () => {
          onOpenChange(false)
          setActiveTab("withdrawals")
          tradingToast.withdrawSuccess(amount, tokenSymbol)
          // Refetch wallet balance after a short delay (server processes in background)
          setTimeout(() => {
            refetchWalletBalance()
          }, 5000)
        },
        onError: (error) => {
          tradingToast.withdrawFailed(
            error instanceof Error ? error.message.split("\n")[0] : undefined
          )
        },
      }
    )
  }, [
    amount,
    selectedAssetId,
    tokenSymbol,
    isValidAmount,
    withdraw,
    refetchWalletBalance,
    onOpenChange,
    setActiveTab,
  ])

  // --- Reset state when modal closes ---
  useEffect(() => {
    if (!open) {
      startTransition(() => setAmount(""))
      resetWithdraw()
    }
  }, [open, resetWithdraw])

  // --- Button ---
  const buttonText = useMemo(() => {
    if (isInsufficientBalance) return "Insufficient Balance"
    return "Withdraw"
  }, [isInsufficientBalance])

  const isButtonDisabled =
    !isValidAmount || isInsufficientBalance || isWithdrawPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Withdraw</DialogTitle>
          <DialogDescription className="sr-only">
            Withdraw {tokenSymbol} from your perp account
          </DialogDescription>
        </DialogHeader>

        {isWithdrawPending ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <div className="text-center text-sm text-muted-foreground">
              Processing withdrawal...
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Withdraw Token */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Withdraw Token</span>
              <TokenSelect
                assetIds={tokenIds}
                value={selectedAssetId}
                onValueChange={setSelectedAssetId}
                className="h-8"
              />
            </div>

            {/* Available Balance */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available</span>
              <span>
                {formattedPerpBalance} {tokenSymbol}
              </span>
            </div>

            {/* Amount Input */}
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                placeholder="0.000000"
                className="h-12 w-full rounded-md border border-input bg-transparent px-3 pr-14 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              />
              <button
                type="button"
                onClick={handleMax}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-xs font-semibold text-primary hover:text-primary/80"
              >
                Max
              </button>
            </div>

            {/* Error messages */}
            {withdrawError && (
              <p className="text-xs text-destructive">
                Withdraw failed:{" "}
                {withdrawError instanceof Error
                  ? withdrawError.message.split("\n")[0]
                  : "Unknown error"}
              </p>
            )}

            {/* Withdraw success */}
            {isWithdrawSuccess && (
              <p className="text-xs text-green-500">
                Withdraw requested! Tokens will be sent to your wallet shortly.
              </p>
            )}

            {/* Withdraw Button */}
            <Button
              className="w-full"
              disabled={isButtonDisabled}
              onClick={handleWithdraw}
            >
              {buttonText}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
