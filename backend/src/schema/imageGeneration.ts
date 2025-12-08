// src/schema/imageGeneration.ts
import { gql } from 'apollo-server-express';

export const imageGenerationSchema = gql`
  type ImageGenerationResponse {
    success: Boolean!
    images: [String!] # base64 encoded images
    error: String
    model: String!
    timestamp: String!
    generationTime: String!
  }

  input ImageGenerationInput {
    prompt: String!
    negativePrompt: String
    width: Int
    height: Int
    steps: Int
    guidanceScale: Float
    numImages: Int
  }

  type ImageGenerationStatus {
    available: Boolean!
    message: String!
    model: String!
    maxPromptLength: Int!
    defaultDimensions: String!
  }

  extend type Query {
    # Check Hugging Face service status
    imageGenerationStatus: ImageGenerationStatus!
  }

  extend type Mutation {
    # Generate a single image
    generateImage(input: ImageGenerationInput!): ImageGenerationResponse!
    
    # Generate 4 variants (for your UI grid)
    generateImageVariants(prompt: String!): ImageGenerationResponse!
  }
`;