// Telegram file handling - no AWS required
// Uses Telegram's built-in file storage system

export async function saveTelegramFile(ctx: any, fileId: string): Promise<string> {
  try {
    // Get file info from Telegram
    const file = await ctx.api.getFile(fileId);
    
    // Return the Telegram file path for storage
    // Telegram files are accessible via: https://api.telegram.org/file/bot<TOKEN>/<file_path>
    return file.file_path;
  } catch (error) {
    console.error('Error getting file info:', error);
    // Return a fallback reference
    return `telegram-file-${Date.now()}`;
  }
}

export async function getTelegramFileUrl(filePath: string): Promise<string> {
  // Generate direct Telegram file URL
  return `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${filePath}`;
}

// Legacy function names for compatibility
export const saveTelegramFileToS3 = saveTelegramFile;
export const getS3SignedUrl = getTelegramFileUrl;
