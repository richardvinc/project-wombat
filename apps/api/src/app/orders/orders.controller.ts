import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderResponseDto } from './dto/create-order-response.dto';
import { MakePaymentDto } from './dto/make-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { UserOrderStatusResponseDto } from './dto/user-order-status-response.dto';
import { OrdersService } from './services/orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  attemptPurchase(
    @Body() createOrderDto: CreateOrderDto,
  ): CreateOrderResponseDto {
    return this.ordersService.attemptPurchase(createOrderDto);
  }

  @Get(':username/status')
  getOrderStatus(
    @Param('username') username: string,
  ): UserOrderStatusResponseDto {
    return this.ordersService.getOrderStatus(username);
  }

  @Post(':username/payment')
  makePayment(
    @Param('username') username: string,
    @Body() makePaymentDto: MakePaymentDto,
  ): PaymentResponseDto {
    return this.ordersService.makePayment(username, makePaymentDto);
  }
}
