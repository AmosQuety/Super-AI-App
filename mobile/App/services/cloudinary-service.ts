// services/cloudinary-service.ts
const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

function requireCloudinaryConfig(): { cloudName: string; uploadPreset: string } {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error(
      'File uploads are not configured: set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET'
    );
  }
  return { cloudName: CLOUDINARY_CLOUD_NAME, uploadPreset: CLOUDINARY_UPLOAD_PRESET };
}

export const uploadToCloudinary = async (fileUri: string, fileType: string) => {
  const { cloudName, uploadPreset } = requireCloudinaryConfig();
  const formData = new FormData();

  // Determine resource type
  const resourceType = fileType.startsWith('image/') ? 'image' : 'raw';

  // @ts-ignore - React Native FormData handling
  formData.append('file', {
    uri: fileUri,
    type: fileType,
    name: `upload_${Date.now()}`,
  });
  formData.append('upload_preset', uploadPreset);
  formData.append('cloud_name', cloudName);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, // Use specific resource type
      {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message);
    }

    return {
      url: result.secure_url, // Always use secure_url
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload file');
  }
};
