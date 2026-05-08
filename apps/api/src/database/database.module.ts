import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from '../app/orders/entities/order.entity';
import { FlashSaleEntity } from '../app/sale/entities/flash-sale.entity';
import { migrations } from './migrations/migrations';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.getOrThrow<string>('DATABASE_HOST'),
        port: 5432, // hardcoded on purpose
        username: configService.getOrThrow<string>('DATABASE_USER'),
        password: configService.getOrThrow<string>('DATABASE_PASSWORD'),
        database: configService.getOrThrow<string>('DATABASE_NAME'),
        entities: [FlashSaleEntity, OrderEntity],
        migrations,
        autoLoadEntities: true,
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
  ],
})
export class DatabaseModule {}
