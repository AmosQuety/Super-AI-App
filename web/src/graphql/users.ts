// src/graphql/users.ts
import { gql } from "@apollo/client";

// ==================== Auth Queries ====================
export const GET_ME = gql`
  query GetMe {
    me {
      id
      email
      name
      role
      avatarUrl
      isActive
      createdAt
      hasFaceRegistered
    }
  }
`;

export const GET_USERS = gql`
  query GetUsers {
    users {
      id
      email
      name
      role
      isActive
      createdAt
    }
  }
`;

// ==================== Auth Mutations ====================
export const REGISTER = gql`
  mutation Register($email: String!, $password: String!, $name: String) {
    register(email: $email, password: $password, name: $name) {
      user {
        id
        email
        name
        role
        createdAt
      }
      token
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      user {
        id
        email
        name
        role
        createdAt
      }
      token
    }
  }
`;

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($name: String, $email: String) {
    updateProfile(name: $name, email: $email) {
      id
      email
      name
      role
      avatarUrl
      createdAt
    }
  }
`;

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
    changePassword(currentPassword: $currentPassword, newPassword: $newPassword) {
      success
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
        createdAt
      }
      message
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

export const ADD_WORKSPACE_CHARACTER = gql`
  mutation AddWorkspaceCharacter($image: Upload!, $workspaceId: ID!, $name: String!) {
    addWorkspaceCharacter(image: $image, workspaceId: $workspaceId, name: $name) {
      success
      message
    }
  }
`;


export const REGISTER_USER_FACE = gql`
  mutation RegisterUserFace($image: Upload!) {
    registerUserFace(image: $image) {
      success
      message
    }
  }
`;




