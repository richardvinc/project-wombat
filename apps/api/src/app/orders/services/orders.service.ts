import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CreateOrderResponseDto,
  PurchaseAttemptResult,
} from '../dto/create-order-response.dto';
import { CreateOrderDto } from '../dto/create-order.dto';
import { MakePaymentDto } from '../dto/make-payment.dto';
import { PaymentResponseDto, PaymentResult } from '../dto/payment-response.dto';
import {
  UserOrderStatusResponseDto,
  UserOrderStatusResult,
} from '../dto/user-order-status-response.dto';

@Injectable()
export class OrdersService {
  attemptPurchase(createOrderDto: CreateOrderDto): CreateOrderResponseDto {
    // sale not started/ended
    // queue full
    // already paid
    // already reserved
    // reserved successfully

    // fail
    return {
      username: createOrderDto.username,
      result: PurchaseAttemptResult.READY_FOR_PAYMENT,
      orderId: null,
      message:
        'Your slot in on queue. Please make payment for the next 5 minutes.',
    };
  }

  getOrderStatus(username: string): UserOrderStatusResponseDto {
    // paid
    // reserved
    // expired
    // none

    return {
      username,
      result: UserOrderStatusResult.PAID,
      orderId: null,
    };
  }

  makePayment(
    username: string,
    _makePaymentDto: MakePaymentDto,
  ): PaymentResponseDto {
    // no active reservation
    // payment failed

    // payment success
    return {
      username,
      orderId: randomUUID(),
      paymentReferenceId: randomUUID(),
      result: PaymentResult.PAYMENT_ACCEPTED,
      message: 'Payment success.',
    };
  }
}
