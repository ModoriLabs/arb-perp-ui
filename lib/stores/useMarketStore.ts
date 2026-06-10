import { create } from "zustand"
import { Pair } from "@/types"

const DEFAULT_PAIR: Pair = {
  id: 100,
  name: "BTC-PERP",
  market_type: "Perpetual",
  base: "BTC",
  base_scale_k: 100000,
  taker_fee: 0,
  maker_fee: 0,
  quote: "EL$",
  quote_scale_k: 100000,
  base_currency: 3762,
  quote_currency: 5382,
}

interface MarketState {
  selectedPairId: number
  selectedPrice: string
  pairs: Pair[]

  setSelectedPairId: (id: number) => void
  setSelectedPrice: (price: string) => void
  setPairs: (pairs: Pair[]) => void
}

export const useMarketStore = create<MarketState>((set) => ({
  selectedPairId: DEFAULT_PAIR.id,
  selectedPrice: "",
  pairs: [DEFAULT_PAIR],

  setSelectedPairId: (id) => set({ selectedPairId: id }),
  setSelectedPrice: (price) => set({ selectedPrice: price }),
  setPairs: (pairs) => set({ pairs }),
}))

// Selector: derive the currently selected Pair object
export const selectSelectedPair = (state: MarketState): Pair => {
  return (
    state.pairs.find((p) => p.id === state.selectedPairId) ??
    state.pairs[0] ??
    DEFAULT_PAIR
  )
}

// Convenience hook
export function useSelectedPair(): Pair {
  return useMarketStore(selectSelectedPair)
}
