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

export const CHANGE_PASSWORD_MUTATION = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword) {
      success
      message
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

export const RECENT_CHATS = gql`
  query RecentChats($userId: ID!) {
    chats(userId: $userId) {
      id
      title
      updatedAt
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
