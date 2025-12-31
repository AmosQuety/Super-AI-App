import { AppContext } from "../types/context";
import { Upload } from "../types/upload";
import { CloudinaryService } from "../../services/cloudinaryService";
import { DocumentProcessor } from "../../services/documentProcessor";

const processor = new DocumentProcessor();

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

      // 2. Upload to Cloudinary (Storage)
      // Note: Make sure CloudinaryService.uploadFile returns the secure_url
      const uploadResult: any = await CloudinaryService.uploadFile(buffer, "rag_documents");
      const fileUrl = uploadResult.secure_url;

      // 3. Extract Text
      const fullText = await processor.extractText(buffer, mimetype);
      if (!fullText) throw new Error("Could not extract text from document");

      // 4. Create Document in DB (Prisma)
      const document = await context.prisma.document.create({
        data: {
          filename,
          fileType: mimetype,
          fileUrl,
          userId: context.user.userId, // Use userId from token
        }
      });

      // 5. Chunk & Embed
      const textChunks = processor.chunkText(fullText, 800); // 800 chars per chunk
      console.log(`📄 Splitting ${filename} into ${textChunks.length} chunks...`);

      for (let i = 0; i < textChunks.length; i++) {
        const content = textChunks[i];
        
        // A. Generate Vector (Gemini)
        const vector = await context.geminiAIService.getEmbedding(content);

        // B. Save Chunk (Prisma)
        const chunk = await context.prisma.documentChunk.create({
          data: {
            content,
            chunkIndex: i,
            documentId: document.id
          }
        });

        // C. Save Vector (Raw SQL because Prisma doesn't support vector writes easily yet)
        // Format vector as string "[0.1, 0.2, ...]"
        const vectorString = `[${vector.join(",")}]`;
        
        await context.prisma.$executeRaw`
          UPDATE "DocumentChunk"
          SET embedding = ${vectorString}::vector
          WHERE id = ${chunk.id}
        `;
      }

      return {
        success: true,
        message: `Processed ${filename} into ${textChunks.length} knowledge chunks.`
      };

    } catch (error: any) {
      console.error("Upload Error:", error);
      return { success: false, message: error.message };
    }
  }
};