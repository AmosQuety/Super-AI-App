import { gql } from "@apollo/client";

export const CREATE_AUDIO_JOB = gql`
  mutation CreateAudioJob(
    $userId: ID!
    $type: String!
    $inputText: String
    $inputAudioUrl: String
  ) {
    createAudioJob(
      userId: $userId
      type: $type
      inputText: $inputText
      inputAudioUrl: $inputAudioUrl
    ) {
      id
      type
      status
      outputUrl
      createdAt
    }
  }
`;

export const GET_AUDIO_JOBS = gql`
  query GetAudioJobs($userId: ID!) {
    audioJobs(userId: $userId) {
      id
      type
      status
      outputUrl
      errorMessage
      createdAt
    }
  }
`;

export const SAVE_TRANSCRIPT = gql`
  mutation SaveTranscript($userId: ID!, $text: String!) {
    saveTranscript(userId: $userId, text: $text) {
      id
      text
      createdAt
    }
  }
`;