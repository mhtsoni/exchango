import AWS from 'aws-sdk';
import axios from 'axios';
import path from 'path';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

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
    
    // Generate unique key
    const timestamp = Date.now();
    const filename = path.basename(file.file_path);
    const key = `proofs/${timestamp}-${filename}`;
    
    // Upload to S3
    const uploadParams = {
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: response.data,
      ContentType: 'application/octet-stream'
    };
    
    await s3.upload(uploadParams).promise();
    
    return key;
  } catch (error) {
    console.error('Error saving file to S3:', error);
    throw new Error('Failed to save file to S3');
  }
}

export async function getS3SignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const params = {
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Expires: expiresIn
    };
    
    return s3.getSignedUrl('getObject', params);
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error('Failed to generate signed URL');
  }
}
