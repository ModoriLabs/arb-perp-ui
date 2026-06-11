"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useChainId,
  useSwitchChain,
} from "wagmi"
import { useQueryClient } from "@tanstack/react-query"
import { formatUnits, parseUnits } from "viem"
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
  CONTRACTS,
  COLLATERAL_TOKENS,
  ASSET_ID_TO_CHAIN_ID,
  getTokenAddress,
} from "@/lib/contracts/addresses"
import { getFeeOverrides } from "@/lib/contracts/gas"
import { MockTokenAbi } from "@/lib/contracts/abi/MockTokenAbi"
import { ElysiaPerpAbi } from "@/lib/contracts/abi/ElysiaPerpAbi"
import { apiClient, ApiError } from "@/lib/api/client"
import { tradingToast } from "@/lib/utils/toast"
import { useHistoryTabStore, useSelectedPair } from "@/lib/stores"
import { TokenSelect } from "@/components/trading/token-select"
import { ASSET_IDS } from "@/lib/constants/assets"
import { getAssetName } from "@/lib/utils"
import type { AccountResponse, VerifyDepositResponse } from "@/types"

interface DepositModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  address: `0x${string}`
}

export function DepositModal({
  open,
  onOpenChange,
  address,
}: DepositModalProps) {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState("")
  const setActiveTab = useHistoryTabStore((s) => s.setActiveTab)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSwitchingChain, setIsSwitchingChain] = useState(false)

  // Wallet's current chain and a switch helper. We always anchor reads/writes
  // against the chain that owns the selected token (`targetChainId`), not the
  // wallet's current chain — wagmi will refuse a write if the wallet isn't on
  // it, which is what triggers the on-demand switchChain in handleDeposit.
  const walletChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()

  // Union of every collateral asset across every supported chain (ELP-133 +
  // multi-chain). Order: walk the chain map in declaration order so the
  // default-token-on-mount stays predictable.
  const tokenIds = useMemo(
    () =>
      Object.values(COLLATERAL_TOKENS).flatMap((list) =>
        list.map((t) => t.assetId)
      ),
    []
  )

  // Default the token picker to the currently-traded market's quote
  // collateral so the common "I'm trading X, top up X" flow proceeds
  // without any chain-switch or token-picker fiddling.
  const pair = useSelectedPair()
  const initialAssetId = tokenIds.includes(pair.quote_currency)
    ? pair.quote_currency
    : ASSET_IDS.ARB
  const [selectedAssetId, setSelectedAssetId] = useState<number>(initialAssetId)

  // Re-sync to the current market each time the modal opens. Otherwise
  // the default only "takes" on the first ever mount — re-opening after
  // switching markets keeps stale state.
  useEffect(() => {
    if (open) {
      setSelectedAssetId(
        tokenIds.includes(pair.quote_currency)
          ? pair.quote_currency
          : ASSET_IDS.ARB
      )
    }
  }, [open, pair.quote_currency, tokenIds])

  // The chain that hosts the currently selected collateral. Falls back to the
  // wallet's chain so an unknown token doesn't crash the modal (it just
  // produces an "undefined token address" downstream which the UI handles).
  const targetChainId = ASSET_ID_TO_CHAIN_ID[selectedAssetId] ?? walletChainId
  const isWrongChain = walletChainId !== targetChainId

  const tokenAddress =
    getTokenAddress(targetChainId, selectedAssetId) ??
    COLLATERAL_TOKENS[targetChainId]?.[0]?.address
  const perpAddress = CONTRACTS[targetChainId]?.elysiaPerp
  const tokenSymbol = getAssetName(selectedAssetId)

  // Track whether we've already submitted a deposit hash to prevent duplicates
  const submittedHashRef = useRef<string | null>(null)

  // All reads pin `chainId: targetChainId` so they hit the right network
  // even when the wallet is currently on a different one (e.g. user picked
  // ARB while still connected to Sepolia — we want to show their actual ARB
  // balance/allowance immediately, not wait for the switch).
  const { data: decimals } = useReadContract({
    address: tokenAddress,
    abi: MockTokenAbi,
    functionName: "decimals",
    chainId: targetChainId,
    query: { enabled: !!tokenAddress },
  })

  const { data: walletBalance, refetch: refetchWalletBalance } =
    useReadContract({
      address: tokenAddress,
      abi: MockTokenAbi,
      functionName: "balanceOf",
      args: [address],
      chainId: targetChainId,
      query: { enabled: !!address && !!tokenAddress },
    })

  const { data: allowance } = useReadContract({
    address: tokenAddress,
    abi: MockTokenAbi,
    functionName: "allowance",
    args: perpAddress ? [address, perpAddress] : undefined,
    chainId: targetChainId,
    query: { enabled: !!address && !!tokenAddress && !!perpAddress },
  })

  // --- Write: approve ---
  const {
    writeContract: approveWrite,
    data: approveHash,
    isPending: isApprovePending,
    error: approveError,
    reset: resetApprove,
  } = useWriteContract()

  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveHash })

  // --- Write: deposit ---
  const {
    writeContract: depositWrite,
    data: depositHash,
    isPending: isDepositPending,
    error: depositError,
    reset: resetDeposit,
  } = useWriteContract()

  const d = decimals ?? 18
  const displayDecimals = 6 // internal policy: 6 decimal places

  // --- Computed values ---
  const formattedBalance = useMemo(() => {
    if (walletBalance == null) return "-"
    const raw = formatUnits(walletBalance, d)
    const num = parseFloat(raw)
    if (isNaN(num)) return "-"
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: displayDecimals,
    })
  }, [walletBalance, d])

  const placeholder = useMemo(() => {
    return `0.${"0".repeat(displayDecimals)}`
  }, [displayDecimals])

  const parsedAmount = useMemo(() => {
    if (!amount || isNaN(Number(amount))) return null
    try {
      return parseUnits(amount, d)
    } catch {
      return null
    }
  }, [amount, d])

  const isInsufficientBalance = useMemo(() => {
    if (parsedAmount == null || walletBalance == null) return false
    return parsedAmount > walletBalance
  }, [parsedAmount, walletBalance])

  const needsApproval = useMemo(() => {
    if (parsedAmount == null || allowance == null) return false
    return allowance < parsedAmount
  }, [parsedAmount, allowance])

  const isBelowMinimum = useMemo(() => {
    if (!amount || parsedAmount == null) return false
    try {
      const minAmount = parseUnits("1000", d)
      return parsedAmount < minAmount
    } catch {
      return false
    }
  }, [amount, parsedAmount, d])

  const isValidAmount = useMemo(() => {
    if (!amount || parsedAmount == null) return false
    if (parsedAmount <= 0n) return false
    return !isBelowMinimum
  }, [amount, parsedAmount, isBelowMinimum])

  const isBusy =
    isApprovePending ||
    isApproveConfirming ||
    isDepositPending ||
    isSubmitting ||
    isSwitchingChain

  // --- Input handler: limit decimal places ---
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

      const dotIndex = value.indexOf(".")
      if (dotIndex !== -1) {
        const decimalPart = value.slice(dotIndex + 1)
        if (decimalPart.length > displayDecimals) return
      }

      setAmount(value)
    },
    [displayDecimals]
  )

  const handleMax = useCallback(() => {
    if (walletBalance == null) return
    const raw = formatUnits(walletBalance, d)
    const dotIdx = raw.indexOf(".")
    const truncated =
      dotIdx === -1 ? raw : raw.slice(0, dotIdx + displayDecimals + 1)
    setAmount(truncated)
  }, [walletBalance, d, displayDecimals])

  // --- Deposit action ---
  const handleDeposit = useCallback(async () => {
    if (parsedAmount == null || decimals == null) return
    if (!tokenAddress || !perpAddress) return

    // Make sure the wallet is on the chain that owns the selected token
    // before we ask it to sign. switchChainAsync rejects with the wallet's
    // standard "user rejected" error if the user declines, which the
    // existing approve/deposit error handler already surfaces.
    if (isWrongChain) {
      try {
        setIsSwitchingChain(true)
        await switchChainAsync({ chainId: targetChainId })
      } catch {
        setIsSwitchingChain(false)
        tradingToast.depositFailed("Network switch was declined")
        return
      } finally {
        setIsSwitchingChain(false)
      }
    }

    const feeOverrides = getFeeOverrides(targetChainId)
    if (needsApproval) {
      approveWrite({
        address: tokenAddress,
        abi: MockTokenAbi,
        functionName: "approve",
        args: [perpAddress, parsedAmount],
        chainId: targetChainId,
        ...feeOverrides,
      })
    } else {
      depositWrite({
        address: perpAddress,
        abi: ElysiaPerpAbi,
        functionName: "deposit",
        args: [tokenAddress, parsedAmount, 0],
        chainId: targetChainId,
        ...feeOverrides,
      })
    }
  }, [
    parsedAmount,
    decimals,
    needsApproval,
    approveWrite,
    depositWrite,
    tokenAddress,
    perpAddress,
    isWrongChain,
    switchChainAsync,
    targetChainId,
  ])

  // --- Auto-trigger deposit after approve success ---
  useEffect(() => {
    if (
      isApproveSuccess &&
      parsedAmount != null &&
      decimals != null &&
      perpAddress &&
      tokenAddress
    ) {
      depositWrite({
        address: perpAddress,
        abi: ElysiaPerpAbi,
        functionName: "deposit",
        args: [tokenAddress, parsedAmount, 0],
        chainId: targetChainId,
        ...getFeeOverrides(targetChainId),
      })
    }
  }, [
    isApproveSuccess,
    parsedAmount,
    decimals,
    depositWrite,
    perpAddress,
    tokenAddress,
    targetChainId,
  ])

  // --- POST tx_hash to server when deposit tx is signed ---
  useEffect(() => {
    if (!depositHash || submittedHashRef.current === depositHash) return
    submittedHashRef.current = depositHash

    setIsSubmitting(true)

    const MAX_RETRIES = 20
    const RETRY_DELAY = 3000

    const submitDeposit = async (): Promise<VerifyDepositResponse> => {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const res = await apiClient<VerifyDepositResponse>("/account/deposit", {
          method: "POST",
          body: { tx_hash: depositHash },
          auth: true,
        })
        // Server returns status "not_mined" when receipt is not yet available
        if (res.status === "not_mined") {
          await new Promise((r) => setTimeout(r, RETRY_DELAY))
          continue
        }
        return res
      }
      throw new Error("Transaction not mined after multiple attempts")
    }

    submitDeposit()
      .then(async () => {
        setActiveTab("deposits")
        await queryClient.refetchQueries({ queryKey: ["deposit-history"] })
        onOpenChange(false)
        refetchWalletBalance()
        tradingToast.depositSuccess()

        // Refresh the perp account so `Avbl` reflects the credited deposit.
        // The ["account"] query backs the available balance everywhere
        // (header pill + trading form). The catch: the backend only credits
        // the perp balance AFTER the deposit tx reaches enough block
        // confirmations, which lags the verify response by a few seconds. A
        // single refetch here reads the pre-credit balance, so Avbl appeared
        // to update "only on reload". Poll a bounded number of times until
        // the credited balance actually shows up, then stop.
        const readAvailable = () =>
          queryClient
            .getQueryData<AccountResponse>(["account"])
            ?.accounts?.[0]?.balances?.find(
              (b) => b.asset_id === selectedAssetId
            )?.available

        const before = readAvailable()
        for (let attempt = 0; attempt < 12; attempt++) {
          await queryClient.refetchQueries({ queryKey: ["account"] })
          if (readAvailable() !== before) break
          await new Promise((r) => setTimeout(r, 5000))
        }
      })
      .catch((error) => {
        onOpenChange(false)
        if (error instanceof ApiError) {
          tradingToast.depositFailed(
            "Deposit verification failed. Please try again later."
          )
        } else {
          tradingToast.depositFailed(error.message)
        }
      })
      .finally(() => {
        setIsSubmitting(false)
      })
  }, [
    depositHash,
    onOpenChange,
    setActiveTab,
    queryClient,
    refetchWalletBalance,
    selectedAssetId,
  ])

  // --- Handle wallet rejection errors via toast ---
  useEffect(() => {
    if (!approveError && !depositError) return
    onOpenChange(false)

    const error = approveError ?? depositError!
    const isUserRejected =
      error.message.includes("User denied") ||
      error.message.includes("User rejected")

    if (approveError) {
      tradingToast.depositFailed(
        isUserRejected
          ? "Approval was declined"
          : "Approval failed. Please try again."
      )
    } else {
      tradingToast.depositFailed(
        isUserRejected
          ? "Deposit transaction was declined"
          : "Deposit failed. Please try again."
      )
    }
  }, [approveError, depositError, onOpenChange])

  // --- Reset state when modal closes ---
  useEffect(() => {
    if (!open) {
      setAmount("")
      resetApprove()
      resetDeposit()
      submittedHashRef.current = null
    }
  }, [open, resetApprove, resetDeposit])

  // --- Button ---
  const buttonText = useMemo(() => {
    if (isInsufficientBalance) return "Insufficient Balance"
    if (isBelowMinimum) return `Minimum deposit amount is 1,000 ${tokenSymbol}`
    if (isWrongChain) return `Switch network & deposit`
    return "Deposit"
  }, [isInsufficientBalance, isBelowMinimum, tokenSymbol, isWrongChain])

  const isButtonDisabled = !isValidAmount || isInsufficientBalance || isBusy

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isApproveConfirming ? "Approve" : "Deposit"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isApproveConfirming
              ? `Approve ${tokenSymbol} spending for deposit`
              : `Deposit ${tokenSymbol} to your perp account`}
          </DialogDescription>
        </DialogHeader>

        {/* Waiting for deposit tx to be mined + verified */}
        {isSubmitting && depositHash ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <div className="text-center text-sm text-muted-foreground">
              Deposit submitting...
            </div>
          </div>
        ) : /* Waiting for approval confirmation */
        isApproveConfirming && approveHash ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <div className="text-center text-sm text-muted-foreground">
              Waiting for approval confirmation
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Deposit Token */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Deposit Token</span>
              <TokenSelect
                assetIds={tokenIds}
                value={selectedAssetId}
                onValueChange={setSelectedAssetId}
                className="h-8"
              />
            </div>

            {/* Available Balance */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Wallet Balance</span>
              <span>
                {formattedBalance} {tokenSymbol}
              </span>
            </div>

            {/* Minimum Deposit */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Minimum Deposit</span>
              <span>1,000 {tokenSymbol}</span>
            </div>

            {/* Amount Input */}
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={handleAmountChange}
                placeholder={placeholder}
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

            {/* Deposit Button */}
            <Button
              className="w-full"
              disabled={isButtonDisabled}
              onClick={handleDeposit}
            >
              {isApprovePending || isDepositPending || isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                buttonText
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
