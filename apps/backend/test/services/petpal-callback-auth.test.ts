import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
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
        wechatpayVerifyProvider: 'HMAC',
        wechatpayNotifySecret: '',
        wechatpayTimestampToleranceSeconds: 300,
        wechatpayMerchantId: '',
        wechatpayAppId: '',
        wechatpayCertSerialNo: '',
        wechatpayPlatformPublicKey: '',
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
        wechatpayVerifyProvider: 'HMAC',
        wechatpayNotifySecret: secret,
        wechatpayTimestampToleranceSeconds: 300,
        wechatpayMerchantId: '',
        wechatpayAppId: '',
        wechatpayCertSerialNo: '',
        wechatpayPlatformPublicKey: '',
      },
    );
  });

  it('rejects invalid wechatpay signature', () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = 'nonce-invalid';
    const rawBody = '{"payNo":"P-1"}';

    assert.throws(() => {
      verifyPetpalCallbackAuth(
        {
          'x-wechatpay-signature': 'invalid-signature',
          'x-wechatpay-timestamp': timestamp,
          'x-wechatpay-nonce': nonce,
        },
        rawBody,
        {
          mode: 'WECHATPAY',
          callbackToken: 'ignored-token',
          wechatpayVerifyProvider: 'HMAC',
          wechatpayNotifySecret: 'wechatpay-test-secret',
          wechatpayTimestampToleranceSeconds: 300,
          wechatpayMerchantId: '',
          wechatpayAppId: '',
          wechatpayCertSerialNo: '',
          wechatpayPlatformPublicKey: '',
        },
      );
    });
  });

  it('rejects expired wechatpay timestamp', () => {
    const timestamp = (Math.floor(Date.now() / 1000) - 1000).toString();
    const nonce = 'nonce-expired';
    const rawBody = '{"payNo":"P-2"}';
    const secret = 'wechatpay-test-secret';
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}\n${nonce}\n${rawBody}\n`)
      .digest('base64');

    assert.throws(() => {
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
          wechatpayVerifyProvider: 'HMAC',
          wechatpayNotifySecret: secret,
          wechatpayTimestampToleranceSeconds: 30,
          wechatpayMerchantId: '',
          wechatpayAppId: '',
          wechatpayCertSerialNo: '',
          wechatpayPlatformPublicKey: '',
        },
      );
    });
  });
});
