import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { env } from '../config/env';
import { forbidden } from '../utils/errors';
import { verifyWechatpayBySdkPath } from './petpal-wechatpay-sdk-adapter';

type CallbackAuthMode = 'TOKEN' | 'WECHATPAY';

type CallbackAuthConfig = {
  mode: CallbackAuthMode;
  callbackToken: string;
  wechatpayVerifyProvider: 'HMAC' | 'SDK';
  wechatpayNotifySecret: string;
  wechatpayTimestampToleranceSeconds: number;
  wechatpayMerchantId: string;
  wechatpayAppId: string;
  wechatpayCertSerialNo: string;
  wechatpayPlatformPublicKey: string;
};

const normalizeHeader = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
};

const assertTokenAuthorized = (
  headers: IncomingHttpHeaders,
  callbackToken: string,
) => {
  const token = normalizeHeader(headers['x-petpal-callback-token']);
  if (!token || token !== callbackToken) {
    throw forbidden('Invalid callback token');
  }
};

const safeEquals = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const assertWechatpayAuthorized = (
  headers: IncomingHttpHeaders,
  rawBody: string,
  config: Pick<
    CallbackAuthConfig,
    | 'wechatpayVerifyProvider'
    | 'wechatpayNotifySecret'
    | 'wechatpayTimestampToleranceSeconds'
    | 'wechatpayMerchantId'
    | 'wechatpayAppId'
    | 'wechatpayCertSerialNo'
    | 'wechatpayPlatformPublicKey'
  >,
) => {
  const timestampRaw = normalizeHeader(headers['x-wechatpay-timestamp']);
  if (!timestampRaw) {
    throw forbidden('Invalid wechatpay callback timestamp');
  }

  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp)) {
    throw forbidden('Invalid wechatpay callback timestamp');
  }

  const driftSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (driftSeconds > config.wechatpayTimestampToleranceSeconds) {
    throw forbidden('Wechatpay callback timestamp expired');
  }

  if (config.wechatpayVerifyProvider === 'SDK') {
    verifyWechatpayBySdkPath(headers, rawBody, {
      merchantId: config.wechatpayMerchantId,
      appId: config.wechatpayAppId,
      certSerialNo: config.wechatpayCertSerialNo,
      platformPublicKey: config.wechatpayPlatformPublicKey,
    });
    return;
  }

  if (!config.wechatpayNotifySecret) {
    throw forbidden('WeChat Pay callback secret is not configured');
  }

  const signature = normalizeHeader(headers['x-wechatpay-signature']);
  const nonce = normalizeHeader(headers['x-wechatpay-nonce']);

  if (!signature || !nonce) {
    throw forbidden('Invalid wechatpay callback signature headers');
  }

  const signPayload = `${timestampRaw}\n${nonce}\n${rawBody}\n`;
  const expected = createHmac('sha256', config.wechatpayNotifySecret)
    .update(signPayload)
    .digest('base64');

  if (!safeEquals(signature, expected)) {
    throw forbidden('Invalid wechatpay callback signature');
  }
};

const getAuthConfig = (): CallbackAuthConfig => ({
  mode: env.PETPAL_CALLBACK_AUTH_MODE,
  callbackToken: env.PETPAL_CALLBACK_TOKEN,
  wechatpayVerifyProvider: env.PETPAL_WECHATPAY_VERIFY_PROVIDER,
  wechatpayNotifySecret: env.PETPAL_WECHATPAY_NOTIFY_SECRET,
  wechatpayTimestampToleranceSeconds: env.PETPAL_WECHATPAY_TIMESTAMP_TOLERANCE_SECONDS,
  wechatpayMerchantId: env.PETPAL_WECHATPAY_MERCHANT_ID,
  wechatpayAppId: env.PETPAL_WECHATPAY_APP_ID,
  wechatpayCertSerialNo: env.PETPAL_WECHATPAY_CERT_SERIAL_NO,
  wechatpayPlatformPublicKey: env.PETPAL_WECHATPAY_PLATFORM_PUBLIC_KEY,
});

export const verifyPetpalCallbackAuth = (
  headers: IncomingHttpHeaders,
  rawBody: string,
  config = getAuthConfig(),
) => {
  if (config.mode === 'WECHATPAY') {
    assertWechatpayAuthorized(headers, rawBody, config);
    return;
  }

  assertTokenAuthorized(headers, config.callbackToken);
};
