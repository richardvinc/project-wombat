import { Injectable } from '@nestjs/common';

@Injectable()
export class PaymentSimulatorService {
  async process(forceSuccess?: boolean): Promise<boolean> {
    if (typeof forceSuccess === 'boolean') {
      return forceSuccess;
    }

    // plan to apply some randomizer in the future to simulate payment failure
    return true;
  }
}
