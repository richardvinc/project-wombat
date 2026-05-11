import request from 'supertest';
import { Repository } from 'typeorm';
import {
  createApiTestApp,
  createWorkerTestApp,
} from '../test/create-api-test-app';
import { OrderEntity } from './orders/entities/order.entity';
import { createOrdersRedisKeys } from './orders/orders.redis-keys';

async function waitFor(
  assertion: () => Promise<void>,
  timeoutMs = 5_000,
): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw lastError;
}

describe('API integration', () => {
  it('returns current flash sale status', async () => {
    const ctx = await createApiTestApp();

    try {
      const response = await request(ctx.app.getHttpServer())
        .get('/api/flash-sale/status')
        .expect(200);

      expect(response.body).toMatchObject({
        saleId: 'main',
        status: 'active',
        totalStock: 2,
        availableSlots: 2,
      });
      expect(response.body.startTime).toEqual(expect.any(String));
      expect(response.body.endTime).toEqual(expect.any(String));
    } finally {
      await ctx.close();
    }
  });

  it('reserves slot through buy endpoint and stores reservation state', async () => {
    const ctx = await createApiTestApp();

    try {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/orders/buy')
        .send({ username: 'alice' })
        .expect(201);

      expect(response.body).toMatchObject({
        username: 'alice',
        status: 'reserved',
      });
      await expect(
        ctx.redis.get(createOrdersRedisKeys('main').reservedUser('alice')),
      ).resolves.toBe(response.body.reservationId);
    } finally {
      await ctx.close();
    }
  });

  it('rejects blank username on buy', async () => {
    const ctx = await createApiTestApp();

    try {
      const response = await request(ctx.app.getHttpServer())
        .post('/api/orders/buy')
        .send({ username: '   ' })
        .expect(400);

      expect(response.body).toMatchObject({
        status: 'missing_username',
      });
    } finally {
      await ctx.close();
    }
  });

  it('rejects second active reservation for same user', async () => {
    const ctx = await createApiTestApp();

    try {
      await request(ctx.app.getHttpServer())
        .post('/api/orders/buy')
        .send({ username: 'alice' })
        .expect(201);

      const response = await request(ctx.app.getHttpServer())
        .post('/api/orders/buy')
        .send({ username: 'alice' })
        .expect(409);

      expect(response.body).toMatchObject({
        status: 'already_reserved',
      });
    } finally {
      await ctx.close();
    }
  });

  it('rate limits after too many buy attempts', async () => {
    const ctx = await createApiTestApp();

    try {
      await request(ctx.app.getHttpServer())
        .post('/api/orders/buy')
        .send({ username: 'alice' })
        .expect(201);

      let response: request.Response | undefined;

      for (let attempt = 0; attempt < 10; attempt += 1) {
        response = await request(ctx.app.getHttpServer())
          .post('/api/orders/buy')
          .send({ username: 'alice' });

        if (response.status === 429) {
          break;
        }
      }

      expect(response?.status).toBe(429);

      expect(response?.body).toMatchObject({
        status: 'too_many_requests',
      });
    } finally {
      await ctx.close();
    }
  });

  it('returns none, reserved, then paid status for user lifecycle', async () => {
    const ctx = await createApiTestApp();

    try {
      await request(ctx.app.getHttpServer())
        .get('/api/orders/status')
        .query({ username: 'bob' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.status).toBe('none');
        });

      const buyResponse = await request(ctx.app.getHttpServer())
        .post('/api/orders/buy')
        .send({ username: 'bob' })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .get('/api/orders/status')
        .query({ username: 'bob' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.status).toBe('reserved');
          expect(body.reservationId).toBe(buyResponse.body.reservationId);
        });

      await request(ctx.app.getHttpServer())
        .post('/api/orders/pay')
        .send({
          username: 'bob',
          reservationId: buyResponse.body.reservationId,
          forceSuccess: true,
        })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .get('/api/orders/status')
        .query({ username: 'bob' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.status).toBe('paid');
        });
    } finally {
      await ctx.close();
    }
  });

  it('creates paid order row after successful payment', async () => {
    const ctx = await createApiTestApp();
    const orderRepository = ctx.dataSource.getRepository(
      OrderEntity,
    ) as Repository<OrderEntity>;
    let workerCtx: Awaited<ReturnType<typeof createWorkerTestApp>> | undefined;

    try {
      const buyResponse = await request(ctx.app.getHttpServer())
        .post('/api/orders/buy')
        .send({ username: 'carol' })
        .expect(201);

      await request(ctx.app.getHttpServer())
        .post('/api/orders/pay')
        .send({
          username: 'carol',
          reservationId: buyResponse.body.reservationId,
          forceSuccess: true,
        })
        .expect(201);

      workerCtx = await createWorkerTestApp();

      await waitFor(async () => {
        const order = await orderRepository.findOneBy({
          flashSaleId: 'main',
          username: 'carol',
        });

        expect(order).toMatchObject({
          username: 'carol',
          reservationId: buyResponse.body.reservationId,
          status: 'paid',
        });
      });
    } finally {
      if (workerCtx) {
        await workerCtx.close();
      }
      await ctx.close();
    }
  });

  it('returns payment_failed when payment simulator is forced to fail', async () => {
    const ctx = await createApiTestApp();

    try {
      const buyResponse = await request(ctx.app.getHttpServer())
        .post('/api/orders/buy')
        .send({ username: 'dave' })
        .expect(201);

      const paymentResponse = await request(ctx.app.getHttpServer())
        .post('/api/orders/pay')
        .send({
          username: 'dave',
          reservationId: buyResponse.body.reservationId,
          forceSuccess: false,
        })
        .expect(201);

      expect(paymentResponse.body).toMatchObject({
        username: 'dave',
        status: 'payment_failed',
        reservationId: buyResponse.body.reservationId,
      });

      await request(ctx.app.getHttpServer())
        .get('/api/orders/status')
        .query({ username: 'dave' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.status).toBe('reserved');
        });
    } finally {
      await ctx.close();
    }
  });

  it('rejects pay when reservation id mismatched', async () => {
    const ctx = await createApiTestApp();

    try {
      await request(ctx.app.getHttpServer())
        .post('/api/orders/buy')
        .send({ username: 'erin' })
        .expect(201);

      const response = await request(ctx.app.getHttpServer())
        .post('/api/orders/pay')
        .send({
          username: 'erin',
          reservationId: 'wrong-id',
          forceSuccess: true,
        })
        .expect(403);

      expect(response.body).toMatchObject({
        status: 'invalid_reservation',
      });
    } finally {
      await ctx.close();
    }
  });

  it('rejects pay when no reservation exists anymore', async () => {
    const ctx = await createApiTestApp();

    try {
      const buyResponse = await request(ctx.app.getHttpServer())
        .post('/api/orders/buy')
        .send({ username: 'frank' })
        .expect(201);

      await ctx.redis.del(
        createOrdersRedisKeys('main').reservedUser('frank'),
        createOrdersRedisKeys('main').reservation(
          buyResponse.body.reservationId,
        ),
      );

      const response = await request(ctx.app.getHttpServer())
        .post('/api/orders/pay')
        .send({
          username: 'frank',
          reservationId: buyResponse.body.reservationId,
          forceSuccess: true,
        })
        .expect(404);

      expect(response.body).toMatchObject({
        status: 'no_active_reservation',
      });
    } finally {
      await ctx.close();
    }
  });
});
