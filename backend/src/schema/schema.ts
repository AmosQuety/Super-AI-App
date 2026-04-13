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
    preferences: UserPreferences
    lastLoginAt: DateTime
    isActive: Boolean!
    chats: [Chat!]
    tasks: [Task!]
    images: [ImageGeneration!]
    audioJobs: [AudioJob!]
    documents: [Document!]
    createdAt: DateTime!
    updatedAt: DateTime!
    hasFaceRegistered: Boolean
    hasVoiceRegistered: Boolean
    totalChats: Int
    totalMessages: Int
    totalVoiceJobs: Int
    totalDocuments: Int
  }

  type PushNotificationConfig {
    enabled: Boolean!
    publicKey: String
    serviceWorkerUrl: String!
    rolloutPercent: Int!
    reason: String
  }

  type PushSubscription {
    id: ID!
    userId: ID!
    endpoint: String!
    deviceLabel: String
    userAgent: String
    isActive: Boolean!
    lastSuccessAt: DateTime
    lastFailureAt: DateTime
    lastFailureReason: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type PushDeliveryMetrics {
    windowMinutes: Int!
    sent: Int!
    failed: Int!
    clicked: Int!
    openedApp: Int!
    transientFailures: Int!
    permanentFailures: Int!
    failureRate: Float!
  }

  enum PushEngagementEventType {
    CLICKED
    OPENED_APP
  }

  type UserPreferences {
    tone: String           # "casual" | "formal"
    detail: String         # "concise" | "detailed"
    techDepth: String      # "beginner" | "intermediate" | "expert"
    responseFormat: String # "prose" | "bullets" | "mixed"
    role: String           # e.g. "Software Developer"
    domain: String         # e.g. "React, TypeScript"
    goals: String          # e.g. "Building a SaaS product"
    language: String       # e.g. "English"
  }

  input PreferencesInput {
    tone: String
    detail: String
    techDepth: String
    responseFormat: String
    role: String
    domain: String
    goals: String
    language: String
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
    filename: String!
    fileType: String!
    fileUrl: String!
    status: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Task {
    id: ID!
    user: User!
    userId: String!
    feature: String!
    status: String!
    progress: Int!
    metadata: String
    resultReference: String
    errorMessage: String
    startedAt: DateTime
    completedAt: DateTime
    failedAt: DateTime
    canceledAt: DateTime
    archivedAt: DateTime
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

  type VoiceCloneResponse {
    success: Boolean!
    message: String
    audioUrl: String
    jobId: String
    status: String
    error: String
  }

  type VoiceJobStatus {
    status: String!  # PROCESSING | COMPLETED | FAILED
    success: Boolean
    message: String
    audioUrl: String
    error: String
  }

  type SecurityAuditLog {
    id: ID!
    userId: ID
    userEmail: String
    event: String!
    ipAddress: String
    userAgent: String
    details: String
    createdAt: DateTime!
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

    task(id: ID!): Task
    myTasks(limit: Int = 20, includeArchived: Boolean = false): [Task!]!

    pushNotificationConfig: PushNotificationConfig!
    myPushSubscriptions: [PushSubscription!]!
    pushDeliveryMetrics(windowMinutes: Int = 60): PushDeliveryMetrics!

    getVoiceJobStatus(jobId: String!): VoiceJobStatus!

    securityAuditLogs(userId: ID, limit: Int): [SecurityAuditLog!]!
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
    registerUserFace(image: Upload!): GenericResponse!
    addWorkspaceCharacter(image: Upload!, workspaceId: ID!, name: String!): GenericResponse!
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

    uploadDocument(file: Upload!): GenericResponse!
    updatePreferences(preferences: PreferencesInput!): User!
    
    registerVoice(referenceAudio: Upload!): VoiceCloneResponse!
    
    removeVoice: GenericResponse!
    
    cloneVoice(text: String!, referenceAudio: Upload): VoiceCloneResponse!
    
    sendMessageWithResponse(chatId: ID!, content: String!, imageUrl: String, fileName: String, fileUri: String, fileMimeType: String, activeDocumentIds: [ID!]): SendMessageResponse!

    processVoiceTask(input: ProcessVoiceTaskInput!): ProcessVoiceTaskResponse!

    registerPushSubscription(input: RegisterPushSubscriptionInput!): PushSubscription!
    unregisterPushSubscription(endpoint: String!): Boolean!
    trackPushEngagement(taskId: ID!, eventType: PushEngagementEventType!, metadata: String): Boolean!
  }

  input RegisterPushSubscriptionInput {
    endpoint: String!
    p256dh: String!
    auth: String!
    deviceLabel: String
    userAgent: String
  }

  input ProcessVoiceTaskInput {
    text: String!
    action: String! # TRANSLATE | SUMMARIZE
    targetLanguage: String
  }

  type ProcessVoiceTaskResponse {
    success: Boolean!
    result: String
    error: String
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
    fileUrl: String
    documentId: ID
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

  type MessageChunk {
    chatId: ID!
    delta: String!
    fullContent: String!
    isDone: Boolean!
  }

  type Subscription {
    messageAdded(chatId: ID!): Message
    messageChunkAdded(chatId: ID!): MessageChunk
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