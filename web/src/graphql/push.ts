import { gql } from "@apollo/client";

export const GET_PUSH_NOTIFICATION_CONFIG = gql`
  query GetPushNotificationConfig {
    pushNotificationConfig {
      enabled
      publicKey
      serviceWorkerUrl
      rolloutPercent
      reason
    }
  }
`;

export const GET_MY_PUSH_SUBSCRIPTIONS = gql`
  query GetMyPushSubscriptions {
    myPushSubscriptions {
      id
      endpoint
      deviceLabel
      userAgent
      isActive
      lastSuccessAt
      lastFailureAt
      lastFailureReason
      createdAt
      updatedAt
    }
  }
`;

export const REGISTER_PUSH_SUBSCRIPTION = gql`
  mutation RegisterPushSubscription($input: RegisterPushSubscriptionInput!) {
    registerPushSubscription(input: $input) {
      id
      endpoint
      isActive
      updatedAt
    }
  }
`;

export const UNREGISTER_PUSH_SUBSCRIPTION = gql`
  mutation UnregisterPushSubscription($endpoint: String!) {
    unregisterPushSubscription(endpoint: $endpoint)
  }
`;

export const TRACK_PUSH_ENGAGEMENT = gql`
  mutation TrackPushEngagement($taskId: ID!, $eventType: PushEngagementEventType!, $metadata: String) {
    trackPushEngagement(taskId: $taskId, eventType: $eventType, metadata: $metadata)
  }
`;