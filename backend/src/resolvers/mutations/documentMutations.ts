import { AppContext } from "../types/context";
import { Upload } from "../types/upload";
import { CloudinaryService } from "../../services/cloudinaryService";
import { processDocument } from "../../services/documentIngestionService";

export const documentMutations = {
  uploadDocument: async (
    _: any,
    { file }: { file: Promise<Upload> },
    context: AppContext
  ) => {
    if (!context.user) throw new Error("Login required");

    try {
      const { createReadStream, filename, mimetype } = await file;

      // 1. Convert Stream to Buffer
      const chunks: Buffer[] = [];
      for await (const chunk of createReadStream()) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      // 2. Upload to Cloudinary for permanent storage
      const uploadResult: any = await CloudinaryService.uploadFile(buffer, "rag_documents");
      const fileUrl = uploadResult.secure_url;

      // 3. Create the document record.
      const document = await context.prisma.document.create({
        data: {
          filename,
          fileType: mimetype,
          fileUrl,
          userId: context.user.userId,
          status: "processing",
        } as any,
      });

      // 4. Kick off ingestion asynchronously — the mutation returns immediately
      //    and the client polls GET_DOCUMENT_LIFECYCLE until status = 'ready'.
      void processDocument(document.id, {
        prisma: context.prisma,
        embeddingService: context.geminiAIService,
        sourceBuffer: buffer,        // reuse the already-downloaded buffer
        sourceMimeType: mimetype,
      }).catch((error) => {
        console.error(`Document ingestion failed for ${document.id}:`, error);
      });

      return {
        success: true,
        message: `Uploaded ${filename}. Document processing has started.`,
        fileUrl,
        documentId: document.id,
      };
    } catch (error: any) {
      console.error("Upload Error:", error);
      return { success: false, message: error.message };
    }
  },
};