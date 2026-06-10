"use client"

import { useRef, useCallback, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { formatDate, getAssetName } from "@/lib/utils"
import {
  ASSET_ID_TO_CHAIN_ID,
  getExplorerTxUrl,
} from "@/lib/contracts/addresses"
import type { Withdrawal, WithdrawalStatus } from "@/types"

interface WithdrawalsTabProps {
  withdrawals: Withdrawal[]
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}

const GRID_COLS =
  "grid-cols-[minmax(150px,1.5fr)_minmax(120px,1fr)_minmax(100px,1fr)_minmax(160px,1.5fr)]"

function getStatusDisplay(status: WithdrawalStatus) {
  switch (status) {
    case "pending":
      return { text: "Pending", color: "text-warning" }
    case "submitted":
      return { text: "Submitted", color: "text-foreground" }
    case "confirmed":
      return { text: "Confirmed", color: "text-success" }
    case "refunded":
      return { text: "Refunded", color: "text-destructive" }
    default:
      return { text: status, color: "text-foreground" }
  }
}

function truncateHash(hash: string): string {
  if (hash.length <= 12) return hash
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

export function WithdrawalsTab({
  withdrawals,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: WithdrawalsTabProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  )

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0,
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [handleObserver])

  return (
    <div className="h-full overflow-x-scroll p-0">
      {withdrawals.length === 0 ? (
        <div className="h-full p-3">
          <div className="text-sm text-muted-foreground">
            No withdrawal history.
          </div>
        </div>
      ) : (
        <div className="relative w-full">
          <table
            data-testid="withdrawals-table"
            className="relative z-0 grid w-full bg-card text-xs font-light whitespace-nowrap text-foreground"
          >
            <thead className="sticky top-0 z-10 bg-card backdrop-blur-xl">
              <tr className={`grid w-full ${GRID_COLS} px-2`}>
                <th className="flex h-8 min-w-[150px] items-center font-light text-muted-foreground text-xs">
                  Date
                </th>
                <th className="flex h-8 min-w-[120px] items-center font-light text-muted-foreground text-xs">
                  Amount
                </th>
                <th className="flex h-8 min-w-[100px] items-center font-light text-muted-foreground text-xs">
                  Status
                </th>
                <th className="flex h-8 min-w-[160px] items-center font-light text-muted-foreground text-xs">
                  Transaction
                </th>
              </tr>
            </thead>
            <tbody className="relative">
              {withdrawals.map((withdrawal, index) => {
                const status = getStatusDisplay(withdrawal.status)

                return (
                  <tr
                    key={withdrawal.id}
                    data-index={index}
                    data-testid={`row-${index}`}
                    className={`grid w-full ${GRID_COLS} items-center bg-card border-b border-border first:border-t first:border-t-border h-8 px-2 text-xs`}
                  >
                    <td className="flex min-w-[150px]">
                      {formatDate(withdrawal.created_at)}
                    </td>
                    <td className="flex min-w-[120px]">
                      {Number(withdrawal.amount).toLocaleString("en-US", {
                        maximumFractionDigits: 6,
                      })}{" "}
                      {getAssetName(withdrawal.asset_id)}
                    </td>
                    <td className={`flex min-w-[100px] ${status.color}`}>
                      {status.text}
                    </td>
                    <td className="flex min-w-[160px]">
                      {withdrawal.tx_hash ? (
                        <a
                          href={getExplorerTxUrl(
                            // Withdrawal payload already carries
                            // `asset_id`; map it to the chain that hosts
                            // the asset. Avoids the old hard-coded
                            // `sepolia.etherscan.io` link, which sent
                            // ARB withdraws to the wrong explorer.
                            ASSET_ID_TO_CHAIN_ID[withdrawal.asset_id],
                            withdrawal.tx_hash
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-foreground"
                        >
                          {truncateHash(withdrawal.tx_hash)}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Infinite scroll sentinel + loading indicator */}
          <div
            ref={sentinelRef}
            className="flex h-8 items-center justify-center"
          >
            {isFetchingNextPage && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
