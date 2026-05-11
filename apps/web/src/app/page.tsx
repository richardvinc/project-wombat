'use client';

import { useState } from 'react';
import { FlashSaleControls } from './_components/flash-sale-controls';
import { JsonPanel } from './_components/json-panel';

type SaleStatus = {
  saleId: string;
  status: 'upcoming' | 'active' | 'ended';
  totalStock: number;
  availableSlots: number;
  startTime: string;
  endTime: string;
};

type BuyResponse = {
  username: string;
  status: string;
  message: string;
  reservationId: string | null;
  expiresAt: string | null;
};

type PayResponse = {
  username: string;
  status: string;
  reservationId: string | null;
  paymentReferenceId: string | null;
  message: string;
};

type OrderStatusResponse = {
  username: string;
  status: string;
  message: string;
  reservationId: string | null;
  expiresAt: string | null;
};

type ApiError = {
  error?: string;
  message?: string;
  status?: string;
};

type ApiFailure = {
  message: string;
  payload: unknown;
};

export default function Index() {
  const [username, setUsername] = useState('');
  const [saleStatus, setSaleStatus] = useState<SaleStatus | null>(null);
  const [buyResult, setBuyResult] = useState<BuyResponse | null>(null);
  const [payResult, setPayResult] = useState<PayResponse | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatusResponse | null>(
    null,
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isCheckingOrder, setIsCheckingOrder] = useState(false);

  const reservationId =
    orderStatus?.reservationId ??
    buyResult?.reservationId ??
    payResult?.reservationId ??
    null;

  function isApiFailure(error: unknown): error is ApiFailure {
    return (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      'payload' in error
    );
  }

  async function readResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    const data = text ? (JSON.parse(text) as T | ApiError) : {};

    if (!response.ok) {
      const errorData = data as ApiError;
      throw {
        message:
          errorData.message ??
          errorData.error ??
          errorData.status ??
          response.statusText,
        payload: data,
      } satisfies ApiFailure;
    }

    return data as T;
  }

  function resetMessages() {
    setLastError(null);
  }

  function getUserHeaders(): HeadersInit | undefined {
    if (!username.trim()) {
      return undefined;
    }

    return { 'X-User-Id': username.trim() };
  }

  async function refreshSaleStatus() {
    resetMessages();

    try {
      const response = await fetch('/api/flash-sale/status', {
        cache: 'no-store',
        headers: getUserHeaders(),
      });
      const data = await readResponse<SaleStatus>(response);
      setSaleStatus(data);
    } catch (error) {
      if (isApiFailure(error)) {
        setLastError(error.message);
        setSaleStatus(error.payload as SaleStatus);
      } else {
        setLastError(error instanceof Error ? error.message : String(error));
      }
    }
  }

  async function attemptBuy() {
    setIsBuying(true);
    resetMessages();

    try {
      const response = await fetch('/api/orders/buy', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...getUserHeaders(),
        },
        body: JSON.stringify({ username }),
      });
      const data = await readResponse<BuyResponse>(response);
      setBuyResult(data);
      setOrderStatus({
        username: data.username,
        status: data.status,
        message: data.message,
        reservationId: data.reservationId,
        expiresAt: data.expiresAt,
      });
    } catch (error) {
      if (isApiFailure(error)) {
        setLastError(error.message);
        setBuyResult(error.payload as BuyResponse);
      } else {
        setLastError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setIsBuying(false);
    }
  }

  async function attemptPay() {
    setIsPaying(true);
    resetMessages();

    try {
      const response = await fetch('/api/orders/pay', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...getUserHeaders(),
        },
        body: JSON.stringify({
          username,
          reservationId,
        }),
      });
      const data = await readResponse<PayResponse>(response);
      setPayResult(data);
      setOrderStatus({
        username: data.username,
        status: data.status,
        message: data.message,
        reservationId: data.reservationId,
        expiresAt: null,
      });
    } catch (error) {
      if (isApiFailure(error)) {
        setLastError(error.message);
        setPayResult(error.payload as PayResponse);
      } else {
        setLastError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setIsPaying(false);
    }
  }

  async function fetchOrderStatus() {
    setIsCheckingOrder(true);
    resetMessages();

    try {
      const response = await fetch(
        `/api/orders/status?username=${encodeURIComponent(username)}`,
        { cache: 'no-store', headers: getUserHeaders() },
      );
      const data = await readResponse<OrderStatusResponse>(response);
      setOrderStatus(data);

      if (data.status !== 'reserved') {
        setBuyResult((current) =>
          current
            ? {
                ...current,
                reservationId: null,
                expiresAt: null,
              }
            : current,
        );
      }

      if (data.status === 'paid') {
        setPayResult((current) =>
          current
            ? {
                ...current,
                status: 'paid',
                reservationId: null,
              }
            : {
                username: data.username,
                status: 'paid',
                reservationId: null,
                paymentReferenceId: null,
                message: data.message,
              },
        );
      }
    } catch (error) {
      if (isApiFailure(error)) {
        setLastError(error.message);
        setOrderStatus(error.payload as OrderStatusResponse);
      } else {
        setLastError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      setIsCheckingOrder(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <FlashSaleControls
          username={username}
          onUsernameChange={setUsername}
          onRefreshSaleStatus={() => void refreshSaleStatus()}
          onAttemptBuy={() => void attemptBuy()}
          onAttemptPay={() => void attemptPay()}
          onFetchOrderStatus={() => void fetchOrderStatus()}
          isBuying={isBuying}
          isPaying={isPaying}
          isCheckingOrder={isCheckingOrder}
          lastError={lastError}
        />

        <section className="grid gap-4 lg:grid-cols-2">
          <JsonPanel title="Flash-sale status" value={saleStatus} />
          <JsonPanel title="Buy result" value={buyResult} />
          <JsonPanel title="Pay result" value={payResult} />
          <JsonPanel title="Order status" value={orderStatus} />
        </section>
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
        <p className="text-sm">
          I intentionally not applying any logic for enabling/disabling the
          button on the frontend since I want to show how backend is handling
          all user input and action through frontend. I also not use any
          debounce for the same reason.
        </p>
        <p className="text-sm">
          <em>Username and reservationId are required</em> error while clicking{' '}
          <span className="bg-blue-600 text-white rounded-sm px-2 py-1">
            Attempt pay
          </span>{' '}
          button means that you haven't clicked the{' '}
          <span className="bg-emerald-600 text-white rounded-sm px-2 py-1">
            Attempt buy
          </span>{' '}
          button.
        </p>
      </div>
    </main>
  );
}
