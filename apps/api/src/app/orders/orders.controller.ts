import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderResponseDto } from './dto/create-order-response.dto';
import { MakePaymentDto } from './dto/make-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { UserOrderStatusResponseDto } from './dto/user-order-status-response.dto';
import { OrdersService } from './services/orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('buy')
  async attemptPurchase(
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<CreateOrderResponseDto> {
    return this.ordersService.attemptPurchase(createOrderDto);
  }

  @Get('status')
  async getOrderStatus(
    @Query('username') username: string,
  ): Promise<UserOrderStatusResponseDto> {
    return this.ordersService.getOrderStatus(username);
  }

  @Post('pay')
  async makePayment(
    @Body() makePaymentDto: MakePaymentDto,
  ): Promise<PaymentResponseDto> {
    return this.ordersService.makePayment(makePaymentDto);
  }
}
