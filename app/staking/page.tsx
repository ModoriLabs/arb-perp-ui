// TODO: Replace mock with API once Staking backend is ready

import { PageShell } from "@/components/layout/PageShell"

interface StatCard {
  label: string
  value: string
  hint?: string
}

const STATS: StatCard[] = [
  { label: "Total Staked", value: "48.2M EL", hint: "Network-wide" },
  { label: "Your Stake", value: "0 EL", hint: "Connect wallet" },
  { label: "APR", value: "21.84%", hint: "Variable, last 7d" },
  { label: "Rewards Earned", value: "0 EL", hint: "Unclaimed" },
]

const TIERS = [
  { duration: "30d", multiplier: "1.00x", apr: "12.4%" },
  { duration: "90d", multiplier: "1.35x", apr: "16.7%" },
  { duration: "180d", multiplier: "1.80x", apr: "22.4%" },
  { duration: "365d", multiplier: "2.50x", apr: "31.0%" },
]

export default function StakingPage() {
  return (
    <PageShell
      title="Staking"
      description="Stake EL to earn protocol rewards and a share of trading fees."
    >
      <section className="grid grid-cols-4 gap-3 max-[850px]:grid-cols-2 max-[850px]:gap-2">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 max-[850px]:p-3"
          >
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span className="text-2xl font-semibold tabular-nums max-[850px]:text-lg">
              {s.value}
            </span>
            {s.hint && (
              <span className="text-[11px] text-muted-foreground">
                {s.hint}
              </span>
            )}
          </div>
        ))}
      </section>

      <section className="grid grid-cols-[1fr_360px] gap-6 max-[850px]:grid-cols-1 max-[850px]:gap-4">
        {/* Staking tiers */}
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Lock-up Tiers</h2>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid grid-cols-3 gap-2 border-b border-border px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground max-[850px]:px-3">
              <span>Duration</span>
              <span className="text-right">Multiplier</span>
              <span className="text-right">Effective APR</span>
            </div>
            {TIERS.map((t) => (
              <div
                key={t.duration}
                className="grid grid-cols-3 gap-2 border-b border-border/60 px-4 py-3 text-sm last:border-b-0 max-[850px]:px-3"
              >
                <span className="font-medium">{t.duration}</span>
                <span className="text-right tabular-nums text-muted-foreground">
                  {t.multiplier}
                </span>
                <span className="text-right tabular-nums text-success">
                  {t.apr}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Stake / Unstake form */}
        <aside className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-card p-4">
          <div className="flex gap-1 rounded-md bg-muted p-1">
            <button className="flex-1 rounded-sm bg-background py-1.5 text-xs font-medium text-foreground">
              Stake
            </button>
            <button className="flex-1 rounded-sm py-1.5 text-xs font-medium text-muted-foreground">
              Unstake
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Amount</span>
              <span>Balance: 0 EL</span>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
              <input
                disabled
                placeholder="0.00"
                className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              />
              <span className="text-sm font-medium">EL</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">Lock-up</span>
            <div className="grid grid-cols-4 gap-1">
              {TIERS.map((t) => (
                <button
                  key={t.duration}
                  disabled
                  className="rounded-md border border-border py-1.5 text-xs text-muted-foreground opacity-60"
                >
                  {t.duration}
                </button>
              ))}
            </div>
          </div>

          <button
            disabled
            title="Coming soon"
            className="h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground opacity-60"
          >
            Stake EL
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            Staking will open after mainnet launch.
          </p>
        </aside>
      </section>
    </PageShell>
  )
}
