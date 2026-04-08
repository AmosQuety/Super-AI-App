export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export async function uploadToCloudinary(file: File): Promise<CloudinaryUploadResult> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary is not configured for web uploads.');
  }

  const resourceType = file.type.startsWith('image/') ? 'image' : 'raw';
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    {
      method: 'POST',
      body: formData,
    },
  );

  const payload = await response.json();

  if (!response.ok || payload.error) {
    const message = payload?.error?.message || 'Upload failed';
    throw new Error(message);
  }

  return {
    url: payload.secure_url,
    publicId: payload.public_id,
  };
}
