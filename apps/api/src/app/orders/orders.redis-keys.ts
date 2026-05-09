export function createOrdersRedisKeys(saleId: string) {
  const salePrefix = `sale:${saleId}`;

  return {
    availableSlots(): string {
      return `${salePrefix}:available_slots`;
    },
    reservedUser(username: string): string {
      return `${salePrefix}:reserved:${username}`;
    },
    reservation(reservationId: string): string {
      return `${salePrefix}:reservation:${reservationId}`;
    },
    paidUser(username: string): string {
      return `${salePrefix}:paid:${username}`;
    },
    cooldown(username: string): string {
      return `${salePrefix}:cooldown:${username}`;
    },
    buyAttemptsUser(username: string): string {
      return `${salePrefix}:buy_attempts:${username}`;
    },
    reservationExpiries(): string {
      return `${salePrefix}:reservation_expiries`;
    },
    namespace(): string {
      return `${salePrefix}:*`;
    },
  };
}
