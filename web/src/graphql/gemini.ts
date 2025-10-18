import { gql } from "@apollo/client";

export const GENERATE_GEMINI_CONTENT = gql`
  mutation GenerateGeminiContent($prompt: String!) {
    generateGeminiContent(prompt: $prompt) {
      generatedText
      success
      message
    }
  }
`;

export const GET_FACE_SERVICE_STATUS = gql`
  query GetFaceServiceStatus {
    faceServiceStatus {
      isOnline
      registeredFacesCount
      message
    }
  }
`;