import { gql } from "apollo-server-express";

export const authTypeDefs = gql`
  type AuthPayload {
    user: User!
    token: String!
  }

  type ChangePasswordResponse {
    success: Boolean!
    message: String!
  }

  type DeleteAccountResponse {
    success: Boolean!
    message: String!
  }

  extend type Query {
    me: User!
    users: [User!]!
    getVoiceLoginChallenge(email: String!): String!
  }

  extend type Mutation {
    register(email: String!, password: String!, name: String): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    loginWithVoice(email: String!, challengeCode: String!, audio: Upload!): AuthPayload!
    updateProfile(name: String, email: String): User!
    changePassword(currentPassword: String!, newPassword: String!): ChangePasswordResponse!
    deleteAccount(password: String!): DeleteAccountResponse!
  }
`;