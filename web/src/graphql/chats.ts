import { gql } from "@apollo/client";

export const GET_CHATS = gql`
  query GetChats($userId: ID!) {
    chats(userId: $userId) {
      id
      title
      createdAt
      updatedAt
    }
  }
`;

export const GET_CHAT_HISTORY = gql`
  query GetChatHistory($chatId: ID!, $limit: Int, $offset: Int) {
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
      }
      hasMore
    }
  }
`;

export const CREATE_CHAT = gql`
  mutation CreateChat(
    $userId: ID!
    $title: String
    $messages: [MessageInput!]!
  ) {
    createChat(userId: $userId, title: $title, messages: $messages) {
      id
      title
      messages {
        id
        role
        content
        imageUrl
        fileName
        fileUri
        fileMimeType
        createdAt
      }
    }
  }
`;

export const DELETE_MESSAGE = gql`
  mutation DeleteMessage($messageId: ID!) {
    deleteMessage(messageId: $messageId)
  }
`;

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
      }
      aiMessage {
        id
        role
        content
        createdAt
      }
      usedCustomResponse
    }
  }
`;