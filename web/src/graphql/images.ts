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