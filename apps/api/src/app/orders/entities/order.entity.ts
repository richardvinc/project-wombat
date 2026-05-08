import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FlashSaleEntity } from '../../sale/entities/flash-sale.entity';

export enum OrderStatus {
  PAID = 'paid',
}

@Entity({ name: 'orders' })
@Index('IDX_ORDERS_SALE_USERNAME', ['flashSaleId', 'username'], {
  unique: true,
})
export class OrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  flashSaleId!: string;

  @ManyToOne(() => FlashSaleEntity, { nullable: false })
  @JoinColumn({ name: 'flashSaleId', referencedColumnName: 'id' })
  sale!: FlashSaleEntity;

  @Column({ type: 'varchar', length: 50 })
  username!: string;

  @Column({ type: 'enum', enum: OrderStatus })
  status!: OrderStatus;

  @Column({ type: 'varchar' })
  paymentReferenceNumber!: string;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
