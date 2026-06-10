"use client"

import { useState, useEffect, useCallback } from "react"
import { getAssetName } from "@/lib/utils"

interface PendingWithdrawal {
  id: number
  user_id: number
  address: string
  asset_id: number
  amount: string
  status: string
  created_at: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
const ADMIN_API = `${API_BASE}/api/v1/admin`

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [withdrawals, setWithdrawals] = useState<PendingWithdrawal[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const fetchPending = useCallback(async () => {
    if (!adminKey) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`${ADMIN_API}/withdrawals/pending?limit=50`, {
        headers: { "X-Api-Key": adminKey },
      })
      if (res.status === 403) {
        setError("Invalid admin key")
        setIsAuthenticated(false)
        return
      }
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setWithdrawals(data.withdrawals ?? [])
      setIsAuthenticated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch")
    } finally {
      setLoading(false)
    }
  }, [adminKey])

  const handleLogin = () => {
    if (!adminKey.trim()) return
    fetchPending()
  }

  // Auto-refresh every 10s
  useEffect(() => {
    if (!isAuthenticated) return
    const interval = setInterval(fetchPending, 10000)
    return () => clearInterval(interval)
  }, [isAuthenticated, fetchPending])

  const handleAction = async (
    withdrawalId: number,
    action: "approve" | "deny"
  ) => {
    setActionLoading(withdrawalId)
    setMessage("")
    setError("")
    try {
      const res = await fetch(`${ADMIN_API}/withdrawals/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": adminKey,
        },
        body: JSON.stringify({ withdrawal_id: withdrawalId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `${res.status}`)
      }
      setMessage(
        `Withdrawal #${withdrawalId} ${action === "approve" ? "approved" : "denied"}`
      )
      // Refresh list
      fetchPending()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed")
    } finally {
      setActionLoading(null)
    }
  }

  const formatAmount = (amount: string) => {
    // Server returns raw units (NOTIONAL_DECIMALS = 6)
    const value = parseFloat(amount) / 1_000_000
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString()
  }

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card p-6">
          <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            Enter admin key to manage withdrawals
          </p>
          <input
            type="password"
            placeholder="Admin Key"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Login"}
          </button>
        </div>
      </div>
    )
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">
            Withdrawal Approvals
          </h1>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchPending}
              disabled={loading}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              onClick={() => {
                setIsAuthenticated(false)
                setAdminKey("")
                setWithdrawals([])
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Logout
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-4 rounded-md bg-success/10 px-4 py-2 text-sm text-success">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {withdrawals.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">No pending withdrawals</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Address
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr
                    key={w.id}
                    className="border-t border-border hover:bg-muted/20"
                  >
                    <td className="px-4 py-3 font-mono text-foreground">
                      #{w.id}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {w.address
                        ? `${w.address.slice(0, 6)}...${w.address.slice(-4)}`
                        : `User #${w.user_id}`}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatAmount(w.amount)} {getAssetName(w.asset_id)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500">
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(w.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleAction(w.id, "approve")}
                          disabled={actionLoading === w.id}
                          className="rounded-md bg-success px-3 py-1 text-xs font-medium text-white hover:bg-success/80 disabled:opacity-50"
                        >
                          {actionLoading === w.id ? "..." : "Approve"}
                        </button>
                        <button
                          onClick={() => handleAction(w.id, "deny")}
                          disabled={actionLoading === w.id}
                          className="rounded-md bg-destructive px-3 py-1 text-xs font-medium text-white hover:bg-destructive/80 disabled:opacity-50"
                        >
                          {actionLoading === w.id ? "..." : "Deny"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Auto-refreshes every 10 seconds
        </p>
      </div>
    </div>
  )
}
