import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface PendingDeposit {
  txHash: string
  amount: string
  depositBlock: number
  timestamp: number
}

interface PendingDepositState {
  deposits: PendingDeposit[]
  addDeposit: (deposit: PendingDeposit) => void
  removeDeposit: (txHash: string) => void
}

export const usePendingDepositStore = create<PendingDepositState>()(
  persist(
    (set) => ({
      deposits: [],
      addDeposit: (deposit) =>
        set((state) => ({
          deposits: [...state.deposits, deposit],
        })),
      removeDeposit: (txHash) =>
        set((state) => ({
          deposits: state.deposits.filter((d) => d.txHash !== txHash),
        })),
    }),
    { name: "pending-deposits" }
  )
)
