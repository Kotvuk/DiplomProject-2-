const crypto = require('crypto');

const TOTP_CONFIG = {
  digits: 6,
  period: 30,
  algorithm: 'sha1',
  window: 1,
  issuer: process.env.TWO_FA_ISSUER || 'KotvukAI'
};

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = '';
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, '0');
  }

  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    result += BASE32_CHARS[parseInt(chunk, 2)];
  }

  return result;
}

function base32Decode(str) {
  let bits = '';

  for (const char of str.toUpperCase()) {
    if (char === '=') break;
    const val = BASE32_CHARS.indexOf(char);
    if (val === -1) throw new Error(`Invalid Base32 character: ${char}`);
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

function generateSecret(length = 20) {
  const buffer = crypto.randomBytes(length);
  return base32Encode(buffer);
}

function generateTOTP(secret, time = Date.now()) {
  const counter = Math.floor(time / 1000 / TOTP_CONFIG.period);
  return generateHOTP(secret, counter);
}

function generateHOTP(secret, counter) {
  const decodedSecret = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);

  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac(TOTP_CONFIG.algorithm, decodedSecret);
  hmac.update(counterBuffer);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0x0f;
  const code = (
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff)
  ) % Math.pow(10, TOTP_CONFIG.digits);

  return code.toString().padStart(TOTP_CONFIG.digits, '0');
}

function verifyTOTP(secret, code, window = TOTP_CONFIG.window) {
  if (!secret || !code || code.length !== TOTP_CONFIG.digits) {
    return false;
  }

  const time = Date.now();
  const counter = Math.floor(time / 1000 / TOTP_CONFIG.period);

  for (let i = -window; i <= window; i++) {
    var expectedCode = generateHOTP(secret, counter + i);
    if (expectedCode === code) {
      return true;
    }
  }

  return false;
}

function generateOtpAuthUrl(email, secret) {
  const issuer = encodeURIComponent(TOTP_CONFIG.issuer);
  const accountName = encodeURIComponent(email);

  var params = new URLSearchParams({
    secret,
    issuer: TOTP_CONFIG.issuer,
    algorithm: TOTP_CONFIG.algorithm.toUpperCase(),
    digits: TOTP_CONFIG.digits.toString(),
    period: TOTP_CONFIG.period.toString()
  });

  return `otpauth://totp/${issuer}:${accountName}?${params.toString()}`;
}

function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {

    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

function hashBackupCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function verifyBackupCode(hashedCode, providedCode) {
  const normalizedCode = providedCode.toUpperCase().replace(/[^A-F0-9-]/g, '');
  return hashedCode === hashBackupCode(normalizedCode);
}

module.exports = {

  generateSecret,
  generateTOTP,
  verifyTOTP,

  generateOtpAuthUrl,

  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,

  TOTP_CONFIG
};
