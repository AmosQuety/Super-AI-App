import { AuthenticationError } from "apollo-server-express";
import { AppContext } from "./types/context";

export const voiceTaskResolvers = {
  Mutation: {
    processVoiceTask: async (_: any, { input }: any, context: AppContext) => {
      // 1. Auth Check
      const userId = context.user?.userId || (context.user as any)?.id;
      if (!userId) throw new AuthenticationError("Login required");

      const { text, action, targetLanguage } = input;
      let task: any = null;
      
      if (!text || text.trim() === "") {
        return { success: false, error: "No text provided." };
      }

      try {
        let systemPrompt = "";

        if (action === "TRANSLATE") {
            const lang = targetLanguage || "English";
            systemPrompt = `You are a native speaker and master translator. Translate the following text into ${lang}. Provide ONLY the direct translation, preserving the original tone and intent. Do NOT add notes, explanations, or quotes.`;
        } else if (action === "SUMMARIZE") {
            systemPrompt = `You are an expert at distilling messy thoughts into highly organized notes. Summarize the following transcribed thoughts. Extract the core ideas, group them logically, and present them as a clean, concise bulleted list. Fix any obvious transcription errors. Do not include conversational filler like "Here is the summary".`;
        } else {
            return { success: false, error: `Unknown action: ${action}` };
        }

        task = await context.taskService.createTask({
          userId,
          feature: "voice_processing",
          metadata: {
            action,
            hasTargetLanguage: Boolean(targetLanguage),
          },
        });

        await context.taskService.markProcessing(task.id, userId, {
          action,
          hasTargetLanguage: Boolean(targetLanguage),
        });

        await context.taskService.updateProgress(task.id, userId, 30, {
          action,
          phase: "prompt-prepared",
        });

        const contents = [
            {
                role: "user",
                parts: [{ text: systemPrompt }]
            },
            {
                role: "user",
                parts: [{ text: text.trim() }]
            }
        ];

        // We can just use generateContentStream and await the full string, or if geminiAIService has a single generate method, use that.
        // Let's stream it internally and return the full text.
        let fullResponse = "";
        await context.geminiAIService.generateContentStream(contents, async (delta: string) => {
            fullResponse += delta;
        });

        await context.taskService.updateProgress(task.id, userId, 85, {
          action,
          phase: "response-generated",
        });

        await context.taskService.completeTask(task.id, userId, {
          resultReference: "voice-processing-result",
          metadata: {
            action,
          },
        });

        return {
          success: true,
          result: fullResponse.trim(),
        };

      } catch (error: any) {
        console.error("Voice Task Error:", error);
        if (task) {
          await context.taskService.failTask(task.id, userId, error.message || "Failed to process voice task.", {
            metadata: {
              action,
            },
          });
        }
        return {
            success: false,
            error: error.message || "Failed to process voice task."
        };
      }
    },
  },
};
