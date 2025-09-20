// KMS encryption utilities - Optional for simplified version
// Only used if AWS credentials are provided

import AWS from 'aws-sdk';
import crypto from 'crypto';

// Make KMS optional
const kms = process.env.AWS_ACCESS_KEY_ID && process.env.KMS_KEY_ID ? new AWS.KMS({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
}) : null;

const KEY_ID = process.env.KMS_KEY_ID;

export async function encryptCode(plaintext: string): Promise<Buffer> {
  if (!kms || !KEY_ID) {
    // If KMS is not configured, return plaintext as buffer
    console.log('KMS not configured, storing plaintext');
    return Buffer.from(plaintext, 'utf8');
  }

  try {
    // Generate a data key
    const dataKeyResponse = await kms.generateDataKey({
      KeyId: KEY_ID,
      KeySpec: 'AES_256'
    }).promise();

    const dataKey = dataKeyResponse.Plaintext!;
    const encryptedDataKey = dataKeyResponse.CiphertextBlob!;

    // Encrypt the data
    const cipher = crypto.createCipher('aes-256-cbc', dataKey);
    let encrypted = cipher.update(plaintext, 'utf8', 'binary');
    encrypted += cipher.final('binary');

    // Combine encrypted data key and encrypted data
    const result = Buffer.concat([
      encryptedDataKey,
      Buffer.from(encrypted, 'binary')
    ]);

    return result;
  } catch (error) {
    console.error('Error encrypting code:', error);
    // Fallback to plaintext
    return Buffer.from(plaintext, 'utf8');
  }
}

export async function decryptCode(encryptedBlob: Buffer): Promise<string> {
  if (!kms || !KEY_ID) {
    // If KMS is not configured, return plaintext
    console.log('KMS not configured, returning plaintext');
    return encryptedBlob.toString('utf8');
  }

  try {
    // Extract encrypted data key (first 256 bytes)
    const encryptedDataKey = encryptedBlob.slice(0, 256);
    const encryptedData = encryptedBlob.slice(256);

    // Decrypt the data key
    const dataKeyResponse = await kms.decrypt({
      CiphertextBlob: encryptedDataKey
    }).promise();

    const dataKey = dataKeyResponse.Plaintext!;

    // Decrypt the data
    const decipher = crypto.createDecipher('aes-256-cbc', dataKey);
    let decrypted = decipher.update(encryptedData, 'binary', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Error decrypting code:', error);
    // Fallback to plaintext
    return encryptedBlob.toString('utf8');
  }
}

export async function encryptDeliveryData(data: string): Promise<Buffer> {
  return encryptCode(data);
}

export async function decryptDeliveryData(encryptedBlob: Buffer): Promise<string> {
  return decryptCode(encryptedBlob);
}
