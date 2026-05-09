import { DEFAULT_SALE_ID } from './orders.constants';

const SALE_PREFIX = `sale:${DEFAULT_SALE_ID}`;

export const ordersRedisKeys = {
  availableSlots(): string {
    return `${SALE_PREFIX}:available_slots`;
  },
  reservedUser(username: string): string {
    return `${SALE_PREFIX}:reserved:${username}`;
  },
  reservation(reservationId: string): string {
    return `${SALE_PREFIX}:reservation:${reservationId}`;
  },
  paidUser(username: string): string {
    return `${SALE_PREFIX}:paid:${username}`;
  },
  cooldown(username: string): string {
    return `${SALE_PREFIX}:cooldown:${username}`;
  },
  buyAttemptsUser(username: string): string {
    return `${SALE_PREFIX}:buy_attempts:${username}`;
  },
  reservationExpiries(): string {
    return `${SALE_PREFIX}:reservation_expiries`;
  },
  namespace(): string {
    return `${SALE_PREFIX}:*`;
  },
};
