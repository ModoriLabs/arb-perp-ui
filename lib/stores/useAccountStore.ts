import { create } from "zustand"
import type { Account } from "@/types"

interface AccountState {
  account: Account | null
  setAccount: (account: Account | null) => void
}

export const useAccountStore = create<AccountState>((set) => ({
  account: null,
  setAccount: (account) => set({ account }),
}))

export function selectAccountIndex(state: AccountState): number | null {
  return state.account?.index ?? null
}
