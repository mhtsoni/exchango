import AWS from 'aws-sdk';
import axios from 'axios';
import path from 'path';

// Make S3 optional - if AWS credentials are not provided, store files locally
const s3 = process.env.AWS_ACCESS_KEY_ID ? new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
}) : null;

export async function saveTelegramFileToS3(ctx: any, fileId: string): Promise<string> {
  try {
    // Get file info from Telegram
    const file = await ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
    
    // Download file
    const response = await axios({
      url: fileUrl,
      method: 'GET',
      responseType: 'stream'
    });
    
    if (s3 && process.env.S3_BUCKET) {
      // Upload to S3 if AWS is configured
      const timestamp = Date.now();
      const filename = path.basename(file.file_path);
      const key = `proofs/${timestamp}-${filename}`;
      
      const uploadParams = {
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: response.data,
        ContentType: 'application/octet-stream'
      };
      
      await s3.upload(uploadParams).promise();
      return key;
    } else {
      // Store file reference instead of uploading to S3
      const timestamp = Date.now();
      const filename = path.basename(file.file_path);
      return `telegram-file-${timestamp}-${filename}`;
    }
  } catch (error) {
    console.error('Error saving file:', error);
    // Return a fallback reference
    return `file-${Date.now()}`;
  }
}

export async function getS3SignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  if (!s3 || !process.env.S3_BUCKET) {
    return `File reference: ${key}`;
  }
  
  try {
    const params = {
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Expires: expiresIn
    };
    
    return s3.getSignedUrl('getObject', params);
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return `File reference: ${key}`;
  }
}
