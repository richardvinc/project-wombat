import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateFlashSaleTables1746691200000 implements MigrationInterface {
  name = 'CreateFlashSaleTables1746691200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.createTable(
      new Table({
        name: 'flash-sale',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'productName',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'totalStock',
            type: 'int',
          },
          {
            name: 'remainingStock',
            type: 'int',
          },
          {
            name: 'startAt',
            type: 'timestamptz',
          },
          {
            name: 'endAt',
            type: 'timestamptz',
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."orders_status_enum" AS ENUM('paid')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'orders',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'flashSaleId',
            type: 'uuid',
          },
          {
            name: 'username',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'status',
            type: 'enum',
            enumName: 'orders_status_enum',
            enum: ['paid'],
          },
          {
            name: 'paymentReferenceNumber',
            type: 'varchar',
          },
          {
            name: 'quantity',
            type: 'int',
            default: '1',
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'orders',
      new TableForeignKey({
        columnNames: ['flashSaleId'],
        referencedTableName: 'flash-sale',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createIndex(
      'orders',
      new TableIndex({
        name: 'IDX_ORDERS_SALE_USERNAME',
        columnNames: ['flashSaleId', 'username'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('orders', 'IDX_ORDERS_SALE_USERNAME');

    const ordersTable = await queryRunner.getTable('orders');
    const saleForeignKey = ordersTable?.foreignKeys.find((foreignKey) =>
      foreignKey.columnNames.includes('flashSaleId'),
    );

    if (saleForeignKey) {
      await queryRunner.dropForeignKey('orders', saleForeignKey);
    }

    await queryRunner.dropTable('orders');
    await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
    await queryRunner.dropTable('flash-sale');
  }
}
