// hooks/use-chat-messages.ts
import { useMutation } from '@tanstack/react-query';
import { FileProcessor } from '../services/file-processor';

export const useChatMessages = (chatId: string) => {
  const [sendMessageWithResponse] = useMutation(SEND_MESSAGE_WITH_RESPONSE);

  const sendMessage = async (content: string, fileInfo?: FileInfo) => {
    let processedFile: ProcessedFile | null = null;

    // Process file if attached
    if (fileInfo) {
      processedFile = await FileProcessor.processFileForAI(fileInfo);
    }

    // Prepare message payload
    const messagePayload = {
      chatId,
      content,
      ...(processedFile && {
        imageUrl: processedFile.type === 'image' ? processedFile.fileUrl : undefined,
        fileName: processedFile.metadata.fileName,
        fileUri: processedFile.fileUrl,
        fileMimeType: processedFile.metadata.mimeType
      })
    };

    // Send to backend
    const result = await sendMessageWithResponse({
      variables: messagePayload
    });

    // If file needs backend processing, trigger async processing
    if (processedFile?.needsBackendProcessing) {
      await triggerBackendProcessing(processedFile, chatId);
    }

    return result;
  };

  return { sendMessage };
};