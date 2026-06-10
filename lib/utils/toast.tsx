import { toast } from "sonner"

type Side = "Long" | "Short"
type OrderType = "Limit" | "Market"

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 8,
  })
}

// --- Shared components ---

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute -top-2 -right-2 flex size-[18px] items-center justify-center rounded-full border border-border bg-secondary"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 256"
        className="size-3 text-foreground"
      >
        <line
          x1="200"
          y1="56"
          x2="56"
          y2="200"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="16"
        />
        <line
          x1="200"
          y1="200"
          x2="56"
          y2="56"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="16"
        />
      </svg>
    </button>
  )
}

function SideBadge({ side }: { side: Side }) {
  const isLong = side === "Long"
  return (
    <span
      className={`inline-flex h-5 items-center rounded-sm border px-1 text-xs font-medium ${
        isLong
          ? "border-success/30 bg-success/10 text-success"
          : "border-destructive/30 bg-destructive/10 text-destructive-foreground"
      }`}
    >
      {side.toUpperCase()}
    </span>
  )
}

function StatusBadge({ status }: { status: "success" | "error" }) {
  const isSuccess = status === "success"
  return (
    <span
      className={`inline-flex h-5 items-center gap-1 rounded-sm border px-1 text-xs ${
        isSuccess
          ? "border-success/20 bg-success/5 text-foreground"
          : "border-destructive/20 bg-destructive/5 text-foreground"
      }`}
    >
      {isSuccess ? "Open" : "Failed"}
      {isSuccess && (
        <svg viewBox="0 0 24 25" fill="none" className="size-3.5 text-success">
          <path
            d="M0 12.5C0 5.87258 5.37258 0.5 12 0.5C18.6274 0.5 24 5.87258 24 12.5C24 19.1274 18.6274 24.5 12 24.5C5.37258 24.5 0 19.1274 0 12.5Z"
            fill="currentColor"
            fillOpacity="0.2"
          />
          <path
            d="M11 17.5L11.7071 18.2071C11.5196 18.3946 11.2652 18.5 11 18.5C10.7348 18.5 10.4804 18.3946 10.2929 18.2071L11 17.5ZM10.2929 16.7929L18.2929 8.79289L19.7071 10.2071L11.7071 18.2071L10.2929 16.7929ZM6.70711 11.7929L11.7071 16.7929L10.2929 18.2071L5.29289 13.2071L6.70711 11.7929Z"
            fill="currentColor"
          />
        </svg>
      )}
    </span>
  )
}

// --- Order toast card ---

interface OrderToastParams {
  market: string
  side: Side
  orderType: OrderType
  size: string
  baseCurrency: string
  price: number
  /**
   * Market orders fill at orderbook prices, but we only know the user-submitted
   * slippage ceiling at toast time — the actual VWAP fill isn't on the order
   * response. When `approximate` is true the price is rendered with a "≈"
   * prefix so the user understands it's not the exact fill price.
   */
  approximate?: boolean
}

function OrderToastCard({
  params,
  status,
  onClose,
}: {
  params: OrderToastParams
  status: "success" | "error"
  onClose: () => void
}) {
  const { side, orderType, size, baseCurrency, price, approximate } = params
  return (
    <div className="relative w-[264px] rounded-sm border border-border bg-background shadow-lg">
      <CloseButton onClick={onClose} />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card p-2">
        <span className="text-xs text-muted-foreground">{orderType} Order</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-foreground">{baseCurrency}</span>
          <SideBadge side={side} />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Status</span>
          <StatusBadge status={status} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Size</span>
          <span className="text-xs text-foreground">{size}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Price</span>
          <span className="text-xs text-foreground">
            {approximate ? "≈ " : ""}
            {formatPrice(price)}
          </span>
        </div>
      </div>
    </div>
  )
}

// --- Trading-specific toasts ---

const TOAST_DURATION = 15000

function orderSubmitted(params: OrderToastParams) {
  toast.custom(
    (id) => (
      <OrderToastCard
        params={params}
        status="success"
        onClose={() => toast.dismiss(id)}
      />
    ),
    { duration: TOAST_DURATION }
  )
}

function orderFailed(params: OrderToastParams) {
  toast.custom(
    (id) => (
      <OrderToastCard
        params={params}
        status="error"
        onClose={() => toast.dismiss(id)}
      />
    ),
    { duration: TOAST_DURATION }
  )
}

interface CancelToastParams {
  market: string
  side: Side
  orderType: OrderType
  size: string
  baseCurrency: string
  price: number
}

function orderCancelled(params: CancelToastParams) {
  const { side, orderType, size, baseCurrency, price } = params
  toast.custom(
    (id) => (
      <div className="relative w-[264px] rounded-sm border border-border bg-background shadow-lg">
        <CloseButton onClick={() => toast.dismiss(id)} />

        <div className="flex items-center justify-between border-b border-border bg-card p-2">
          <span className="text-xs text-muted-foreground">
            {orderType} Order
          </span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-foreground">{baseCurrency}</span>
            <SideBadge side={side} />
          </div>
        </div>

        <div className="flex flex-col gap-2 p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Status</span>
            <span className="inline-flex h-5 items-center rounded-sm border border-muted-foreground/20 bg-muted/50 px-1 text-xs text-foreground">
              Cancelled
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Size</span>
            <span className="text-xs text-foreground">{size}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Price</span>
            <span className="text-xs text-foreground">
              {formatPrice(price)}
            </span>
          </div>
        </div>
      </div>
    ),
    { duration: TOAST_DURATION }
  )
}

function depositSuccess() {
  toast.custom(
    (id) => (
      <div className="relative w-[264px] rounded-sm border border-border bg-background shadow-lg">
        <CloseButton onClick={() => toast.dismiss(id)} />

        <div className="flex items-center justify-between border-b border-border bg-card p-2">
          <span className="text-xs text-muted-foreground">Deposit</span>
          <span className="inline-flex h-5 items-center gap-1 rounded-sm border border-success/20 bg-success/5 px-1 text-xs text-foreground">
            Submitted
            <svg
              viewBox="0 0 24 25"
              fill="none"
              className="size-3.5 text-success"
            >
              <path
                d="M0 12.5C0 5.87258 5.37258 0.5 12 0.5C18.6274 0.5 24 5.87258 24 12.5C24 19.1274 18.6274 24.5 12 24.5C5.37258 24.5 0 19.1274 0 12.5Z"
                fill="currentColor"
                fillOpacity="0.2"
              />
              <path
                d="M11 17.5L11.7071 18.2071C11.5196 18.3946 11.2652 18.5 11 18.5C10.7348 18.5 10.4804 18.3946 10.2929 18.2071L11 17.5ZM10.2929 16.7929L18.2929 8.79289L19.7071 10.2071L11.7071 18.2071L10.2929 16.7929ZM6.70711 11.7929L11.7071 16.7929L10.2929 18.2071L5.29289 13.2071L6.70711 11.7929Z"
                fill="currentColor"
              />
            </svg>
          </span>
        </div>

        <div className="p-2">
          <span className="text-xs text-muted-foreground">
            Deposit submitted. Balance will be credited after confirmation.
          </span>
        </div>
      </div>
    ),
    { duration: TOAST_DURATION }
  )
}

function depositFailed(message?: string) {
  toast.custom(
    (id) => (
      <div className="relative w-[264px] rounded-sm border border-border bg-background shadow-lg">
        <CloseButton onClick={() => toast.dismiss(id)} />

        <div className="flex items-center justify-between border-b border-border bg-card p-2">
          <span className="text-xs text-muted-foreground">Deposit</span>
          <StatusBadge status="error" />
        </div>

        <div className="p-2">
          <span className="text-xs text-muted-foreground">
            {message || "Something went wrong"}
          </span>
        </div>
      </div>
    ),
    { duration: TOAST_DURATION }
  )
}

function positionClosed(params: {
  market: string
  side: Side
  size: string
  baseCurrency: string
}) {
  toast.custom(
    (id) => (
      <div className="relative w-[264px] rounded-sm border border-border bg-background shadow-lg">
        <CloseButton onClick={() => toast.dismiss(id)} />
        <div className="flex items-center justify-between border-b border-border bg-card p-2">
          <span className="text-xs text-muted-foreground">Position Closed</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-foreground">
              {params.baseCurrency}
            </span>
            <SideBadge side={params.side} />
          </div>
        </div>
        <div className="flex items-center justify-between p-2">
          <span className="text-xs text-muted-foreground">Size</span>
          <span className="text-xs text-foreground">{params.size}</span>
        </div>
      </div>
    ),
    { duration: TOAST_DURATION }
  )
}

function withdrawSuccess(amount: string, symbol: string) {
  toast.custom(
    (id) => (
      <div className="relative w-[264px] rounded-sm border border-border bg-background shadow-lg">
        <CloseButton onClick={() => toast.dismiss(id)} />

        <div className="flex items-center justify-between border-b border-border bg-card p-2">
          <span className="text-xs text-muted-foreground">Withdraw</span>
          <span className="inline-flex h-5 items-center gap-1 rounded-sm border border-success/20 bg-success/5 px-1 text-xs text-foreground">
            Requested
            <svg
              viewBox="0 0 24 25"
              fill="none"
              className="size-3.5 text-success"
            >
              <path
                d="M0 12.5C0 5.87258 5.37258 0.5 12 0.5C18.6274 0.5 24 5.87258 24 12.5C24 19.1274 18.6274 24.5 12 24.5C5.37258 24.5 0 19.1274 0 12.5Z"
                fill="currentColor"
                fillOpacity="0.2"
              />
              <path
                d="M11 17.5L11.7071 18.2071C11.5196 18.3946 11.2652 18.5 11 18.5C10.7348 18.5 10.4804 18.3946 10.2929 18.2071L11 17.5ZM10.2929 16.7929L18.2929 8.79289L19.7071 10.2071L11.7071 18.2071L10.2929 16.7929ZM6.70711 11.7929L11.7071 16.7929L10.2929 18.2071L5.29289 13.2071L6.70711 11.7929Z"
                fill="currentColor"
              />
            </svg>
          </span>
        </div>

        <div className="flex flex-col gap-2 p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Amount</span>
            <span className="text-xs text-foreground">
              {amount} {symbol}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Tokens will be sent to your wallet shortly.
          </span>
        </div>
      </div>
    ),
    { duration: TOAST_DURATION }
  )
}

function withdrawFailed(message?: string) {
  toast.custom(
    (id) => (
      <div className="relative w-[264px] rounded-sm border border-border bg-background shadow-lg">
        <CloseButton onClick={() => toast.dismiss(id)} />

        <div className="flex items-center justify-between border-b border-border bg-card p-2">
          <span className="text-xs text-muted-foreground">Withdraw</span>
          <StatusBadge status="error" />
        </div>

        <div className="p-2">
          <span className="text-xs text-muted-foreground">
            {message || "Something went wrong"}
          </span>
        </div>
      </div>
    ),
    { duration: TOAST_DURATION }
  )
}

// --- Generic toasts ---

function success(title: string, description?: string) {
  toast.success(title, { description })
}

function error(title: string, description?: string) {
  toast.error(title, { description })
}

function info(title: string, description?: string) {
  toast.info(title, { description })
}

export const tradingToast = {
  orderSubmitted,
  orderFailed,
  orderCancelled,
  positionClosed,
  depositSuccess,
  depositFailed,
  withdrawSuccess,
  withdrawFailed,
  success,
  error,
  info,
}
