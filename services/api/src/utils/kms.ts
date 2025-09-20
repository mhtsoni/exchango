import AWS from 'aws-sdk';
import crypto from 'crypto';

const kms = new AWS.KMS({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const KEY_ID = process.env.KMS_KEY_ID!;

export async function encryptCode(plaintext: string): Promise<Buffer> {
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
    throw new Error('Failed to encrypt code');
  }
}

export async function decryptCode(encryptedBlob: Buffer): Promise<string> {
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
    throw new Error('Failed to decrypt code');
  }
}

export async function encryptDeliveryData(data: string): Promise<Buffer> {
  return encryptCode(data);
}

export async function decryptDeliveryData(encryptedBlob: Buffer): Promise<string> {
  return decryptCode(encryptedBlob);
}
