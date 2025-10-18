// services/cloudinary-service.ts
const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;


export const uploadToCloudinary = async (fileUri: string, fileType: string) => {

    
  const formData = new FormData();
  
  // Determine resource type
  const resourceType = fileType.startsWith('image/') ? 'image' : 'raw';
  
  // @ts-ignore - React Native FormData handling
  formData.append('file', {
    uri: fileUri,
    type: fileType,
    name: `upload_${Date.now()}`,
  });
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, // Use specific resource type
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