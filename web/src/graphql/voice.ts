import { gql } from "@apollo/client";

export const PROCESS_VOICE_TASK = gql`
  mutation ProcessVoiceTask($input: ProcessVoiceTaskInput!) {
    processVoiceTask(input: $input) {
      success
      result
      error
    }
  }
`;

export const REGISTER_VOICE = gql`
  mutation RegisterVoice($referenceAudio: Upload!) {
    registerVoice(referenceAudio: $referenceAudio) {
      success
      message
    }
  }
`;

export const CLONE_VOICE = gql`
  mutation CloneVoice($text: String!, $referenceAudio: Upload) {
    cloneVoice(text: $text, referenceAudio: $referenceAudio) {
      success
      jobId
      status
      error
    }
  }
`;

export const GET_VOICE_JOB_STATUS = gql`
  query GetVoiceJobStatus($jobId: String!) {
    getVoiceJobStatus(jobId: $jobId) {
      status
      success
      audioUrl
      error
      message
    }
  }
`;