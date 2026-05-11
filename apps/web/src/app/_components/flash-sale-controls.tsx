import { ActionButton } from './action-button';

type FlashSaleControlsProps = {
  username: string;
  onUsernameChange: (value: string) => void;
  onRefreshSaleStatus: () => void;
  onAttemptBuy: () => void;
  onAttemptPay: () => void;
  onFetchOrderStatus: () => void;
  isBuying: boolean;
  isPaying: boolean;
  isCheckingOrder: boolean;
  lastError: string | null;
};

export function FlashSaleControls({
  username,
  onUsernameChange,
  onRefreshSaleStatus,
  onAttemptBuy,
  onAttemptPay,
  onFetchOrderStatus,
  isBuying,
  isPaying,
  isCheckingOrder,
  lastError,
}: FlashSaleControlsProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mt-2 text-3xl font-semibold">Project Wombat</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-600">
        Flash-sale simulator with limited stock and queque
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Username
          </span>
          <input
            type="text"
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder="Enter username"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400"
          />
        </label>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <ActionButton
          label="Get flash-sale status"
          onClick={onRefreshSaleStatus}
          variant="neutral"
        />
        <ActionButton
          label="Attempt buy"
          loadingLabel="Buying..."
          isLoading={isBuying}
          onClick={onAttemptBuy}
          variant="success"
        />
        <ActionButton
          label="Attempt pay"
          loadingLabel="Paying..."
          isLoading={isPaying}
          onClick={onAttemptPay}
          variant="primary"
        />
        <ActionButton
          label="Get order status"
          loadingLabel="Checking..."
          isLoading={isCheckingOrder}
          onClick={onFetchOrderStatus}
          variant="secondary"
        />
      </div>

      {lastError ? (
        <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Error: {lastError}
        </div>
      ) : null}
    </section>
  );
}
