import { gql } from "@apollo/client";

export const GET_IMAGES = gql`
  query GetImages($userId: ID!) {
    images(userId: $userId) {
      id
      prompt
      imageUrl
      status
      createdAt
    }
  }
`;

export const GENERATE_IMAGE = gql`
  mutation GenerateImage($userId: ID!, $prompt: String!) {
    generateImage(userId: $userId, prompt: $prompt) {
      id
      prompt
      imageUrl
      status
      createdAt
    }
  }
`;

export const GENERATE_AI_IMAGE_VARIANTS = gql`
  mutation GenerateAIImageVariants($prompt: String!) {
    generateAIImageVariants(prompt: $prompt) {
      success
      images
      error
      generationTime
      model
      timestamp
    }
  }
`;

export const GENERATE_AI_IMAGE = gql`
  mutation GenerateAIImage($input: AIImageGenerationInput!) {
    generateAIImage(input: $input) {
      success
      images
      error
      generationTime
      model
      timestamp
    }
  }
`;

export const GET_AI_IMAGE_STATUS = gql`
  query GetAIImageStatus {
    aiImageGenerationStatus {
      available
      message
      model
      maxPromptLength
      defaultDimensions
    }
  }
`;