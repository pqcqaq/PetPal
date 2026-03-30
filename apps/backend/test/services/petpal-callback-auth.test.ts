import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { verifyPetpalCallbackAuth } from '../../src/services/petpal-callback-auth';

describe('PetPal callback auth', () => {
  it('accepts valid callback token when mode is TOKEN', () => {
    verifyPetpalCallbackAuth(
      { 'x-petpal-callback-token': 'token-1' },
      '{"payNo":"A"}',
      {
        mode: 'TOKEN',
        callbackToken: 'token-1',
        wechatpayNotifySecret: '',
        wechatpayTimestampToleranceSeconds: 300,
      },
    );
  });

  it('accepts valid wechatpay signature when mode is WECHATPAY', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = 'nonce-123';
    const rawBody = '{"refundNo":"R1"}';
    const secret = 'wechatpay-test-secret';
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}\n${nonce}\n${rawBody}\n`)
      .digest('base64');

    verifyPetpalCallbackAuth(
      {
        'x-wechatpay-signature': signature,
        'x-wechatpay-timestamp': timestamp,
        'x-wechatpay-nonce': nonce,
      },
      rawBody,
      {
        mode: 'WECHATPAY',
        callbackToken: 'ignored-token',
        wechatpayNotifySecret: secret,
        wechatpayTimestampToleranceSeconds: 300,
      },
    );
  });
});
