// apps/backend/src/services/cloudinaryService.ts
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class CloudinaryService {
  static async uploadFile(fileBuffer: Buffer, folder: string = 'chat_app') {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: 'auto',
            folder: folder,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(fileBuffer);
    });
  }

  static async deleteFile(publicId: string) {
    return await cloudinary.uploader.destroy(publicId);
  }
}