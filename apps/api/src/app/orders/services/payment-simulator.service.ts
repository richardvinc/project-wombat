import { Injectable } from '@nestjs/common';
import { FlashSaleDemoConfigService } from '../../config/demo.config';

@Injectable()
export class PaymentSimulatorService {
  constructor(private readonly demoConfig: FlashSaleDemoConfigService) {}

  async process(forceSuccess?: boolean): Promise<boolean> {
    if (typeof forceSuccess === 'boolean') {
      return forceSuccess;
    }

    return Math.random() < this.demoConfig.paymentSuccessRate;
  }
}
