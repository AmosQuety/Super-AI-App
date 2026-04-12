import { AuthenticationError } from "apollo-server-express";
import { AppContext } from "./types/context";

export const voiceTaskResolvers = {
  Mutation: {
    processVoiceTask: async (_: any, { input }: any, context: AppContext) => {
      // 1. Auth Check
      const userId = context.user?.userId || (context.user as any)?.id;
      if (!userId) throw new AuthenticationError("Login required");

      const { text, action, targetLanguage } = input;
      
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

        return {
          success: true,
          result: fullResponse.trim(),
        };

      } catch (error: any) {
        console.error("Voice Task Error:", error);
        return {
            success: false,
            error: error.message || "Failed to process voice task."
        };
      }
    },
  },
};
