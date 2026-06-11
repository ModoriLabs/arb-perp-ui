"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAppKit } from "@reown/appkit/react"
import {
  useConnection,
  useChainId,
  useDisconnect,
  useReadContract,
} from "wagmi"
import { erc20Abi, formatUnits } from "viem"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Settings,
  ArrowDownToLine,
  ArrowUpFromLine,
  LogOut,
  Loader2,
} from "lucide-react"
import { useAuth } from "@/lib/hooks/useAuth"
import { useMintToken } from "@/lib/hooks/useMintToken"
import { DepositModal } from "@/components/deposit-modal"
import { WithdrawModal } from "@/components/withdraw-modal"
import { MintModal } from "@/components/mint-modal"
import { AuthModal } from "@/components/auth-modal"
import { InsuranceLoginModal } from "@/components/modals/InsuranceLoginModal"
import { DevToolbar } from "@/components/dev/dev-toolbar"
import { usePendingDepositMonitor } from "@/lib/hooks/usePendingDepositMonitor"
import { usePendingDepositStore } from "@/lib/stores/usePendingDepositStore"
import { useBalance } from "@/lib/hooks/useBalance"
import { useAccount } from "@/lib/hooks/useAccount"
import { useSelectedPair } from "@/lib/stores"
import { arbitrumSepolia } from "@reown/appkit/networks"
import {
  CONTRACTS,
  getTokenAddress,
  ASSET_ID_TO_CHAIN_ID,
} from "@/lib/contracts/addresses"
import { formatAddress } from "@/lib/utils"

function MintButton({ address }: { address: `0x${string}` }) {
  const [mintOpen, setMintOpen] = useState(false)
  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="mr-[10px]"
              onClick={() => setMintOpen(true)}
            >
              Mint
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Mint test ARB</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <MintModal open={mintOpen} onOpenChange={setMintOpen} address={address} />
    </>
  )
}

const NAV_ITEMS = [
  // `/trade` (without a market segment) bounces to the user's last-visited
  // market via `app/trade/page.tsx`. Pointing the Trade nav here — rather
  // than at `/` — means clicking it from another section feels like
  // "return to where I was" rather than "reset to the global default".
  { href: "/trade", label: "Trade" },
] as const

function isNavActive(href: string, pathname: string | null) {
  // Trade tab is active for the root redirect (`/`) AND for any
  // `/trade/<market>` page. Without the `/` clause the nav highlight
  // would briefly clear during the root→/trade/[market] redirect.
  if (href === "/trade") {
    return pathname === "/" || !!pathname?.startsWith("/trade")
  }
  return !!pathname?.startsWith(href)
}

export function Header() {
  const { status, address, isConnected } = useConnection() // 'connecting' | 'connected' | 'disconnected' | 'reconnecting'
  const chainId = useChainId()
  const pathname = usePathname()
  const { open } = useAppKit()
  const {
    isAuthenticated,
    login,
    isLoggingIn,
    accountSwitched,
    clearAccountSwitched,
    isRefreshing,
    isAuthReady,
    showAuthModal,
    setShowAuthModal,
    signOut,
  } = useAuth()
  const { disconnect } = useDisconnect()
  const [depositOpen, setDepositOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [insuranceLoginOpen, setInsuranceLoginOpen] = useState(false)
  const [showInsuranceLogin, setShowInsuranceLogin] = useState(false)

  useEffect(() => {
    setShowInsuranceLogin(localStorage.getItem("@dev") === "insurancefund")
  }, [])

  // Detect Insurance Fund session via account's zero address
  const { data: accountData } = useAccount()
  const isInsuranceFund =
    accountData?.accounts?.[0]?.l1_address ===
    "0x0000000000000000000000000000000000000000"
  // Pin the read to the chain hosting the active market's quote token so
  // the pill keeps showing the right balance even when the wallet is on a
  // different network.
  const selectedPair = useSelectedPair()
  const quoteChainId =
    ASSET_ID_TO_CHAIN_ID[selectedPair.quote_currency] ?? arbitrumSepolia.id
  const quoteTokenAddress =
    getTokenAddress(quoteChainId, selectedPair.quote_currency) ??
    CONTRACTS[quoteChainId]?.collateralToken
  const { decimals: tokenDecimals } = useMintToken(quoteTokenAddress)
  usePendingDepositMonitor()
  const hasPendingDeposits = usePendingDepositStore(
    (s) => s.deposits.length > 0
  )
  const { data: balanceData } = useBalance()
  const { data: walletBalance } = useReadContract({
    address: quoteTokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: quoteChainId,
    query: {
      enabled: !!address && !!quoteTokenAddress,
      refetchInterval: 5000,
    },
  })
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const formattedWalletBalance = useMemo(() => {
    if (walletBalance == null) return "-"
    const num = parseFloat(formatUnits(walletBalance, tokenDecimals ?? 18))
    if (isNaN(num)) return "-"
    const truncated = Math.floor(num * 1e6) / 1e6
    return truncated.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })
  }, [walletBalance, tokenDecimals])
  const perpAvailable = balanceData?.balances?.find(
    (b) => b.asset_id === selectedPair.quote_currency
  )?.available
  const perpNum = perpAvailable != null ? parseFloat(perpAvailable) : null
  const formattedPerpBalance =
    perpNum != null
      ? (Math.floor(perpNum * 100) / 100).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "-"
  // Track mounted state for hydration safety
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Track which connected address we've already kicked off login for.
  // Keying by address (not a bare boolean) lets us re-login after a real
  // account switch while still de-duping prompts within a single session.
  const loginAttemptedAddress = useRef<string | null>(null)

  const handleWithdraw = () => {
    setWithdrawOpen(true)
  }

  // Auto-login when wallet connects.
  //
  // Two things keep the signTypedData prompt from firing 2–3 times per
  // connect:
  //
  //   1. Per-address guard. wagmi's `status` flickers
  //      (connected → reconnecting/disconnected → connected) while AppKit
  //      adds or switches the network. We only schedule a login the first
  //      time we see a given connected `address`, so the flicker can't
  //      re-trigger it.
  //   2. Cleanup that cancels the still-pending login. The login is delayed
  //      300 ms; if `status`/`address` change again inside that window the
  //      effect re-runs and its cleanup clears the previously scheduled
  //      timeout, guaranteeing only the *last* scheduled login survives.
  //
  // We only clear the guard on a genuine disconnect (`status` is
  // "disconnected" or `address` is gone) — never on the transient
  // "connecting"/"reconnecting" states — so a flicker never re-arms it.
  useEffect(() => {
    if (!isAuthReady) return

    if (status === "disconnected" || !address) {
      loginAttemptedAddress.current = null
      return
    }

    // Ignore transient "connecting"/"reconnecting" — wait for a stable
    // "connected" before prompting.
    if (status !== "connected") return

    if (isAuthenticated) {
      loginAttemptedAddress.current = address
      return
    }

    if (isRefreshing) return
    if (isLoggingIn) return
    if (loginAttemptedAddress.current === address) return

    loginAttemptedAddress.current = address
    const timeoutId = setTimeout(() => {
      login()
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [
    status,
    address,
    isAuthenticated,
    isRefreshing,
    isAuthReady,
    isLoggingIn,
    login,
  ])

  // Auto-login when account is switched (after logout completes)
  useEffect(() => {
    if (
      accountSwitched &&
      status === "connected" &&
      !isAuthenticated &&
      !isLoggingIn
    ) {
      clearAccountSwitched()
      // Small delay to ensure logout is fully processed. Cleanup cancels a
      // still-pending prompt if this effect re-runs (e.g. React 18 StrictMode
      // double-invoke in dev, or another status change), preventing a
      // duplicate signature request.
      const timeoutId = setTimeout(() => {
        login()
      }, 300)
      return () => clearTimeout(timeoutId)
    }
  }, [
    accountSwitched,
    status,
    isAuthenticated,
    isLoggingIn,
    login,
    clearAccountSwitched,
  ])

  // (Wake-from-sleep handling: we deliberately do NOT auto-open the wallet
  // modal here. The page itself stays viewable — chart, orderbook, market
  // stats are all public data — and the header keeps a visible "Connect
  // Wallet" button. The user can re-authenticate when they want to trade,
  // without being interrupted by a forced modal the moment they refocus
  // the tab.)

  return (
    <>
      <header className="relative flex items-center justify-between border-b border-border bg-card px-6 py-3 max-[850px]:px-4">
        <div className="flex items-center gap-8">
          <Image
            src="/icons/logo/el_perp.svg"
            alt="Elysia Perp"
            width={120}
            height={28}
            className="cursor-pointer"
          />

          <nav className="flex items-center gap-6 max-[850px]:hidden">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors ${
                  isNavActive(item.href, pathname)
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {/* Dev tools (QA-only) */}
          <DevToolbar />

          {showInsuranceLogin && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInsuranceLoginOpen(true)}
            >
              IF Login
            </Button>
          )}

          {/* Wallet connect / address popover */}
          <div
            {...(!mounted && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {!mounted || !isConnected || !address ? (
              isInsuranceFund ? (
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                  title="Click to log out"
                >
                  🛡️ Insurance Fund
                  <LogOut className="h-3 w-3" />
                </button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => open()}>
                  Connect Wallet
                </Button>
              )
            ) : (
              <>
                <MintButton address={address as `0x${string}`} />
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" disabled={isLoggingIn}>
                      {isLoggingIn
                        ? "Signing..."
                        : `${formatAddress(address)}${chainId !== arbitrumSepolia.id ? " (Wrong Network)" : ""}`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-3">
                    <div className="flex flex-col gap-1">
                      <div className="mb-1 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            Wallet Balance
                          </span>
                          <span>
                            {formattedWalletBalance} {selectedPair.quote}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Avbl</span>
                          <span>
                            {formattedPerpBalance} {selectedPair.quote}
                          </span>
                        </div>
                      </div>
                      <div className="my-1 border-t border-border" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => {
                          setPopoverOpen(false)
                          setDepositOpen(true)
                        }}
                        disabled={!isAuthenticated}
                      >
                        {hasPendingDeposits ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowDownToLine className="h-4 w-4" />
                        )}
                        Deposit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => {
                          setPopoverOpen(false)
                          handleWithdraw()
                        }}
                        disabled={!isAuthenticated}
                      >
                        <ArrowUpFromLine className="h-4 w-4" />
                        Withdraw
                      </Button>
                      <div className="my-1 border-t border-border" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                        onClick={() => {
                          setPopoverOpen(false)
                          disconnect()
                        }}
                      >
                        <LogOut className="h-4 w-4" />
                        Disconnect
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>

          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Settings className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            className="hidden h-9 w-9 max-[850px]:inline-flex"
            onClick={() => setMobileMenuOpen((v) => !v)}
          >
            <span className="relative block h-4 w-5">
              <span
                className={`absolute left-0 right-0 h-0.5 rounded-full bg-current transition-all duration-300 ease-in-out ${
                  mobileMenuOpen
                    ? "top-1/2 -translate-y-1/2 rotate-45"
                    : "top-0"
                }`}
              />
              <span
                className={`absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-current transition-opacity duration-200 ${
                  mobileMenuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`absolute left-0 right-0 h-0.5 rounded-full bg-current transition-all duration-300 ease-in-out ${
                  mobileMenuOpen
                    ? "top-1/2 -translate-y-1/2 -rotate-45"
                    : "bottom-0"
                }`}
              />
            </span>
          </Button>
        </div>

        {/* Mobile dropdown menu — uses grid-rows trick for smooth open/close */}
        <div
          className={`absolute inset-x-0 top-full z-40 grid overflow-hidden bg-card transition-[grid-template-rows,opacity] duration-300 ease-out min-[851px]:hidden ${
            mobileMenuOpen
              ? "grid-rows-[1fr] border-b border-border opacity-100 shadow-lg"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <nav className="overflow-hidden">
            <div className="flex flex-col">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`border-b border-border/50 px-6 py-4 text-base font-semibold transition-colors last:border-b-0 ${
                    isNavActive(item.href, pathname)
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </header>

      {address && (
        <>
          <DepositModal
            open={depositOpen}
            onOpenChange={setDepositOpen}
            address={address}
          />
          <WithdrawModal
            open={withdrawOpen}
            onOpenChange={setWithdrawOpen}
            address={address}
          />
        </>
      )}

      <InsuranceLoginModal
        open={insuranceLoginOpen}
        onOpenChange={setInsuranceLoginOpen}
      />

      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        onTryAgain={() => open()}
      />
    </>
  )
}
