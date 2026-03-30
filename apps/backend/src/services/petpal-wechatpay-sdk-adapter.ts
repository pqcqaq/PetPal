import { createPublicKey, verify } from 'node:crypto';
import { createRequire } from 'node:module';
import type { IncomingHttpHeaders } from 'node:http';
import { forbidden } from '../utils/errors';

type WechatpaySdkConfig = {
  merchantId: string;
  appId: string;
  certSerialNo: string;
  platformPublicKey: string;
};

const normalizeHeader = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
};

const assertSdkConfig = (config: WechatpaySdkConfig) => {
  if (!config.merchantId || !config.appId || !config.certSerialNo || !config.platformPublicKey) {
    throw forbidden('Wechatpay SDK verify config is incomplete');
  }
};

const tryLoadWechatpaySdk = () => {
  const require = createRequire(import.meta.url);
  try {
    return require('wechatpay-node-v3');
  } catch {
    return null;
  }
};

export const verifyWechatpayBySdkPath = (
  headers: IncomingHttpHeaders,
  rawBody: string,
  config: WechatpaySdkConfig,
) => {
  assertSdkConfig(config);

  const signature = normalizeHeader(headers['x-wechatpay-signature']);
  const timestamp = normalizeHeader(headers['x-wechatpay-timestamp']);
  const nonce = normalizeHeader(headers['x-wechatpay-nonce']);

  if (!signature || !timestamp || !nonce) {
    throw forbidden('Invalid wechatpay callback signature headers');
  }

  // Integration path: if official SDK is available, this branch is the hook point.
  // Current project verifies with Node crypto using WeChat Pay platform public key,
  // while keeping the adapter contract stable for direct SDK replacement.
  const sdk = tryLoadWechatpaySdk();
  if (sdk == null) {
    const payload = `${timestamp}\n${nonce}\n${rawBody}\n`;
    const publicKey = createPublicKey(config.platformPublicKey);
    const ok = verify('RSA-SHA256', Buffer.from(payload), publicKey, Buffer.from(signature, 'base64'));
    if (!ok) {
      throw forbidden('Invalid wechatpay callback signature');
    }
    return;
  }

  const payload = `${timestamp}\n${nonce}\n${rawBody}\n`;
  const publicKey = createPublicKey(config.platformPublicKey);
  const ok = verify('RSA-SHA256', Buffer.from(payload), publicKey, Buffer.from(signature, 'base64'));
  if (!ok) {
    throw forbidden('Invalid wechatpay callback signature');
  }
};
