// src/schema/schema.ts 
import { gql } from "apollo-server-express";
import { authTypeDefs } from "./auth";

export const typeDefs = gql`
  scalar Upload
  scalar DateTime  

  type User {
    id: ID!
    email: String!
    name: String
    role: String!
    avatarUrl: String
    lastLoginAt: DateTime
    isActive: Boolean!
    chats: [Chat!]
    images: [ImageGeneration!]
    audioJobs: [AudioJob!]
    documents: [Document!]
    createdAt: DateTime!
    updatedAt: DateTime!
    hasFaceRegistered: Boolean
  }

  type Chat {
    id: ID!
    title: String
    user: User!
    userId: String!
    messages: [Message!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Message {
    id: ID!
    role: String!
    content: String!
    chat: Chat!
    chatId: String!
    imageUrl: String 
    fileName: String
    fileUri: String
    fileMimeType: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type ImageGeneration {
    id: ID!
    user: User!
    userId: String!
    prompt: String!
    imageUrl: String!
    status: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type AudioJob {
    id: ID!
    user: User!
    userId: String!
    type: String!
    inputText: String
    inputAudioUrl: String
    outputUrl: String
    status: String!
    errorMessage: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Document {
    id: ID!
    user: User!
    userId: String!
    title: String
    content: String!
    summary: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type MessagesPayload {
    messages: [Message!]!
    hasMore: Boolean!
  }

  # ===== NEW HUGGING FACE TYPES =====
  type AIImageGenerationResponse {
    success: Boolean!
    images: [String!] # base64 encoded images
    error: String
    model: String!
    timestamp: String!
    generationTime: String!
  }

  input AIImageGenerationInput {
    prompt: String!
    negativePrompt: String
    width: Int
    height: Int
    steps: Int
    guidanceScale: Float
    numImages: Int
  }

  type AIImageGenerationStatus {
    available: Boolean!
    message: String!
    model: String!
    maxPromptLength: Int!
    defaultDimensions: String!
  }
  # ===== END NEW TYPES =====

  type Query {
    # User queries
    me: User!
    users: [User!]!
    
    # Chat queries
    chats(userId: ID!): [Chat!]!
    chatHistory(chatId: ID!, limit: Int, offset: Int): MessagesPayload!
    
    # AI queries
    images(userId: ID!): [ImageGeneration!]!
    
    # Face recognition
    faceServiceStatus: FaceServiceStatus!

    # NEW: Hugging Face status
    aiImageGenerationStatus: AIImageGenerationStatus!

    myWorkspaces: [Workspace!]!
  }

  type Mutation {
    # Auth mutations (from authTypeDefs)
    register(email: String!, password: String!, name: String): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    updateProfile(name: String, email: String): User!
    changePassword(currentPassword: String!, newPassword: String!): ChangePasswordResponse!
    deleteAccount(password: String!): DeleteAccountResponse!
    
    # Chat management
    createChat(userId: ID!, title: String, messages: [MessageInput!]!): Chat!
    updateChat(chatId: ID!, title: String!): Chat!
    deleteChat(chatId: ID!): Boolean!
    
    # Message management
    addMessage(chatId: ID!, role: String!, content: String!): Message!
    deleteMessage(messageId: ID!): Boolean!
    
    # Face recognition
    addFace(image: Upload!, workspaceId: String, characterName: String): GenericResponse!
    loginWithFace(image: Upload!): FaceAuthPayload!
    removeFace: GenericResponse!
    compareFaces(image1: Upload!, image2: Upload!): CompareResult!
    findFaceInCrowd(target: Upload!, crowd: Upload!): FindFaceResult!
    verifyFaceInWorkspace(image: Upload!, workspaceId: String!): FaceAuthPayload!

    # AI content generation
    generateGeminiContent(prompt: String!): GeminiResponse!
    generateImage(userId: ID!, prompt: String!): ImageGeneration!
    generateMultipleImages(userId: ID!, prompt: String!, count: Int): [ImageGeneration!]!

    # NEW: Hugging Face image generation (different names to avoid conflict)
    generateAIImage(input: AIImageGenerationInput!): AIImageGenerationResponse!
    generateAIImageVariants(prompt: String!): AIImageGenerationResponse!

    analyzeFaceAttribute(image: Upload!): FaceAnalysisResult!

    createWorkspace(name: String!, description: String): Workspace!
    deleteWorkspace(id: ID!): Boolean!

    sendMessageWithResponse(chatId: ID!, content: String!, imageUrl: String, fileName: String, fileUri: String, fileMimeType: String): SendMessageResponse!
  }

  input MessageInput {
    role: String!
    content: String!
    imageUrl: String
    fileName: String
    fileUri: String
    fileMimeType: String
  }

  type GenericResponse {
    success: Boolean!
    message: String!
  }
  
  type FaceAuthPayload {
    success: Boolean!
    token: String
    user: User
    message: String!
  }
  
  type FaceServiceStatus {
    isOnline: Boolean!
    registeredFacesCount: Int!
    message: String!
  }
    
  type GeminiResponse {
    generatedText: String!
    success: Boolean!
    message: String
  }

  type SendMessageResponse {
    userMessage: Message!
    aiMessage: Message!
    usedCustomResponse: Boolean!
  }

  type Subscription {
    messageAdded(chatId: ID!): Message
  }

  type FaceAnalysisResult {
    success: Boolean!
    data: FaceAttributes
    error: String
  }

  type FaceAttributes {
    age: Int
    gender: String
    emotion: String
    emotion_score: Float
  }

  
  type CompareResult {
    success: Boolean!
    data: CompareData
    error: String
  }

  type CompareData {
    verified: Boolean
    distance: Float
    similarity_score: Float
    threshold: Float
  }

  type FindFaceResult {
    success: Boolean!
    matches: Int
    processed_image: String # This will contain the Base64 image
    error: String
  }

  type Workspace {
    id: ID!
    name: String!
    faces: [Face!]
    description: String
    isDefault: Boolean!
    faceCount: Int # Computed field
    createdAt: DateTime!
  }

  type Face {
    id: ID!
    name: String!
    imageUrl: String
    createdAt: DateTime!
  }

  ${authTypeDefs}
`;