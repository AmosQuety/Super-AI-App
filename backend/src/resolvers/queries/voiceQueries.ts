import { UserInputError } from "apollo-server-express";
import { AppContext } from "../types/context";
import { AuthorizationService } from "../../auth/authorization";
import { VoiceCloningService } from "../../services/voiceCloningService";

const voiceCloningService = new VoiceCloningService();

// Only tasks created by the voice mutations may vouch for ownership of a voice job.
const VOICE_TASK_FEATURES = ["voice_clone", "voice_registration"];

export const voiceQueries = {
  getVoiceJobStatus: async (_: any, { jobId }: { jobId: string }, context: AppContext) => {
    const user = AuthorizationService.requireAuth(context);

    // A job belongs to the user whose task points at it; other users get "not found".
    const referencingTask = await context.taskService.getTaskByResultReferenceForUser(user.userId, jobId);
    const task = referencingTask && VOICE_TASK_FEATURES.includes(referencingTask.feature) ? referencingTask : null;
    if (!task && !AuthorizationService.isAdmin(user)) {
      throw new UserInputError("Voice job not found");
    }

    const result = await voiceCloningService.getJobStatus(jobId);

    if (task) {
      const normalizedStatus = String(result.status || "").toLowerCase();

      if (normalizedStatus === "completed") {
        await context.taskService.completeTask(task.id, user.userId, {
          resultReference: jobId,
          metadata: {
            source: "voice-job-status",
          },
        });
      }

      if (normalizedStatus === "failed") {
        await context.taskService.failTask(task.id, user.userId, result.error || result.message || "Voice job failed", {
          metadata: {
            source: "voice-job-status",
          },
        });
      }
    }
    
    return {
      success: result.success !== false,
      status: result.status || "FAILED",
      message: result.message,
      audioUrl: result.audioUrl,
      error: result.error
    };
  }
};
