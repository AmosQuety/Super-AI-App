// Update your operations file
import { gql } from '@apollo/client';

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      user {
        id
        email
        name
        role
        avatarUrl
        lastLoginAt
        isActive
        hasFaceRegistered
        createdAt
        updatedAt
      }
      token
    }
  }
`;

export const REGISTER_MUTATION = gql`
  mutation Register($email: String!, $password: String!, $name: String) {
    register(email: $email, password: $password, name: $name) {
      user {
        id
        email
        name
        role
        avatarUrl
        lastLoginAt
        isActive
        hasFaceRegistered
        createdAt
        updatedAt
      }
      token
    }
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      name
      role
      avatarUrl
      lastLoginAt
      isActive
      hasFaceRegistered
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_PROFILE_MUTATION = gql`
  mutation UpdateProfile($name: String, $email: String) {
    updateProfile(name: $name, email: $email) {
      id
      email
      name
      role
      avatarUrl
      lastLoginAt
      isActive
      hasFaceRegistered
      createdAt
      updatedAt
    }
  }
`;

export const GET_CHATS = gql`
  query GetChats($userId: ID!) {
    chats(userId: $userId) {
      id
      title
      userId
      createdAt
      updatedAt
      messages {
        id
        role
        content
        imageUrl
        fileName
        fileUri
        fileMimeType
        createdAt
        updatedAt
      }
    }
  }
`;

export const CREATE_CHAT = gql`
  mutation CreateChat($userId: ID!, $title: String, $messages: [MessageInput!]!) {
    createChat(userId: $userId, title: $title, messages: $messages) {
      id
      title
      userId
      createdAt
      updatedAt
      messages {
        id
        role
        content
        imageUrl
        fileName
        fileUri
        fileMimeType
        createdAt
        updatedAt
      }
    }
  }
`;

// NEW: Add message with file support
export const SEND_MESSAGE_WITH_RESPONSE = gql`
  mutation SendMessageWithResponse(
    $chatId: ID!
    $content: String!
    $imageUrl: String
    $fileName: String
    $fileUri: String
    $fileMimeType: String
  ) {
    sendMessageWithResponse(
      chatId: $chatId
      content: $content
      imageUrl: $imageUrl
      fileName: $fileName
      fileUri: $fileUri
      fileMimeType: $fileMimeType
    ) {
      userMessage {
        id
        role
        content
        imageUrl
        fileName
        fileUri
        fileMimeType
        createdAt
        updatedAt
      }
      aiMessage {
        id
        role
        content
        createdAt
        updatedAt
      }
      usedCustomResponse
    }
  }
`;

// NEW: Chat history with pagination
export const CHAT_HISTORY = gql`
  query ChatHistory($chatId: ID!, $limit: Int, $offset: Int) {
    chatHistory(chatId: $chatId, limit: $limit, offset: $offset) {
      messages {
        id
        role
        content
        imageUrl
        fileName
        fileUri
        fileMimeType
        createdAt
        updatedAt
      }
      hasMore
    }
  }
`;



export const REMOVE_FACE = gql`
  mutation RemoveFace {
    removeFace {
      success
      message
    }
  }
`;

export const FACE_SERVICE_STATUS = gql`
  query FaceServiceStatus {
    faceServiceStatus {
      isOnline
      registeredFacesCount
      message
    }
  }
`;

export const LOGIN_WITH_FACE = gql`
  mutation LoginWithFace($image: Upload!) {
    loginWithFace(image: $image) {
      success
      token
      user {
        id
        email
        name
        role
        avatarUrl
        lastLoginAt
        isActive
        hasFaceRegistered
        createdAt
        updatedAt
      }
      message
    }
  }
`;