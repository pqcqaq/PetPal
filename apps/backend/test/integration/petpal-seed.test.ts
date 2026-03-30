import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  bootstrapBackendTestContext,
  reseedBackendTestContext,
  teardownBackendTestContext,
  type BackendTestContext,
} from '../support/backend-testkit';

let context: BackendTestContext;

before(async () => {
  context = await bootstrapBackendTestContext();
});

beforeEach(async () => {
  await reseedBackendTestContext(context);
});

after(async () => {
  await teardownBackendTestContext(context);
});

describe('PetPal seed integration', () => {
  it('creates owner pet, caregiver profile and matched request', async () => {
    const { prisma } = context;

    const member = await prisma.user.findUnique({
      where: { username: 'user' },
      select: { id: true },
    });
    assert.ok(member);

    const profile = await prisma.caregiverProfile.findFirst({
      where: {
        user: {
          username: 'manager',
        },
      },
      select: {
        id: true,
        auditStatus: true,
      },
    });

    assert.ok(profile);
    assert.equal(profile.auditStatus, 'APPROVED');

    const pet = await prisma.petProfile.findFirst({
      where: {
        ownerId: member.id,
      },
      select: {
        id: true,
        name: true,
        species: true,
      },
    });

    assert.ok(pet);
    assert.equal(pet.name, '豆包');
    assert.equal(pet.species, 'DOG');

    const request = await prisma.serviceRequest.findFirst({
      where: {
        ownerId: member.id,
      },
      select: {
        id: true,
        status: true,
        matchedCaregiverId: true,
      },
    });

    assert.ok(request);
    assert.equal(request.status, 'MATCHED');
    assert.equal(request.matchedCaregiverId, profile.id);
  });

  it('supports multiple payments and partial refund with amount invariants', async () => {
    const { prisma } = context;

    const order = await prisma.orderMain.findUnique({
      where: { orderNo: 'PP202603300001' },
      select: {
        id: true,
        amountTotal: true,
        amountAdjusted: true,
        amountPaid: true,
        amountRefunded: true,
        orderStatus: true,
      },
    });

    assert.ok(order);
    assert.equal(order.orderStatus, 'PARTIAL_REFUNDED');

    const payments = await prisma.paymentRecord.findMany({
      where: { orderId: order.id },
      select: {
        bizType: true,
        payStatus: true,
        payAmount: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    assert.equal(payments.length, 2);
    assert.deepEqual(
      payments.map((item) => item.bizType),
      ['DEPOSIT', 'ADJUSTMENT'],
    );
    assert.ok(payments.every((item) => item.payStatus === 'PAID'));

    const paymentTotal = payments.reduce((sum, item) => sum + Number(item.payAmount), 0);
    assert.equal(paymentTotal, Number(order.amountPaid));

    const refunds = await prisma.refundRecord.findMany({
      where: { orderId: order.id },
      select: {
        refundType: true,
        refundStatus: true,
        refundAmount: true,
      },
    });

    assert.equal(refunds.length, 1);
    assert.equal(refunds[0].refundType, 'PARTIAL');
    assert.equal(refunds[0].refundStatus, 'SUCCESS');

    const refundTotal = refunds.reduce((sum, item) => sum + Number(item.refundAmount), 0);
    assert.equal(refundTotal, Number(order.amountRefunded));

    const expectedGross = Number(order.amountTotal) + Number(order.amountAdjusted);
    assert.equal(expectedGross, 90);
    assert.ok(Number(order.amountPaid) >= expectedGross - Number(order.amountRefunded));
    assert.ok(Number(order.amountPaid) - Number(order.amountRefunded) >= 0);
  });
});
