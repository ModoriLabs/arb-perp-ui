import { create } from "zustand"
import { Position } from "@/types"

interface PositionState {
  positions: Position[]
  setPositions: (positions: Position[]) => void
}

export const usePositionStore = create<PositionState>((set) => ({
  positions: [],
  setPositions: (positions) => set({ positions }),
}))

// Selector: find position for a specific market
export function selectPositionByMarket(marketName: string) {
  return (state: PositionState): Position | undefined =>
    state.positions.find((p) => p.market === marketName)
}

// Selector: check if any positions exist for a specific market name
export function selectHasPositionsForMarket(marketName: string) {
  return (state: PositionState): boolean =>
    state.positions.some((p) => p.market === marketName)
}

// Convenience hook: get the position for the currently selected market
export function useCurrentMarketPosition(
  marketName: string
): Position | undefined {
  return usePositionStore(selectPositionByMarket(marketName))
}
