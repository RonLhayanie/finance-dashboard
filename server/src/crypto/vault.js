const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const masterKeyHex = process.env.MASTER_KEY;
if (!masterKeyHex || masterKeyHex.length !== 64) {
  throw new Error('MASTER_KEY must be set in env as 64 hex chars (32 bytes)');
}
const masterKey = Buffer.from(masterKeyHex, 'hex');

function encrypt(plaintextString) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintextString, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

function decrypt(encrypted, iv, tag) {
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
