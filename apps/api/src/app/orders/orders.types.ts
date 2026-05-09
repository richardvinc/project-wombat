export interface ReservationRecord {
  username: string;
  reservationId: string;
  reservedAt: string;
  expiresAt: string;
}

export interface ReleaseReservationJobData {
  username: string;
  reservationId: string;
}

export interface CreatePaidOrderJobData {
  username: string;
  reservationId: string;
  paymentReferenceNumber: string;
}
