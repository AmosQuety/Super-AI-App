import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create multiple realistic users with hashed passwords (SEQUENTIALLY to avoid SQLite issues)
  const user1 = await prisma.user.upsert({
    where: { email: "alice.johnson@example.com" },
    update: {},
    create: {
      email: "alice.johnson@example.com",
      name: "Alice Johnson",
      password: await hash("SecurePass123!", 12),
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: "bob.smith@example.com" },
    update: {},
    create: {
      email: "bob.smith@example.com",
      name: "Bob Smith",
      password: await hash("MySecret456!", 12),
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: "dev@example.com" },
    update: {},
    create: {
      id: "user-123",
      email: "dev@example.com",
      name: "Development User",
      password: await hash("devpassword123", 12),
    },
  });

  const users = [user1, user2, user3];
  console.log("Created users:", users.map(u => ({ id: u.id, email: u.email })));

  // Create chats and content for each user
  for (const user of users) {
    // Safely handle possible null name
    const firstName = user.name ? user.name.split(' ')[0] : 'User';
    
    // Create chat + messages
    await prisma.chat.create({
      data: {
        userId: user.id,
        title: `Welcome Chat - ${firstName}`,
        messages: {
          create: [
            { role: "user", content: `Hello! I'm ${firstName}, nice to meet you!` },
            {
              role: "assistant",
              content: `Hello ${firstName}! I'm here to help you with your AI tasks. What would you like to explore today?`,
            },
          ],
        },
      },
    });

    // Add image generation examples
    await prisma.imageGeneration.create({
      data: {
        userId: user.id,
        prompt: "A serene landscape with mountains and a lake at sunset",
        imageUrl: "https://placehold.co/600x400/4A90E2/FFFFFF.png?text=Generated+Image",
      },
    });

    // Add audio job examples
    await prisma.audioJob.create({
      data: {
        userId: user.id,
        type: "speech_to_text",
        inputAudioUrl: "https://example.com/audio/sample-lecture.mp3",
        outputUrl: "This is a transcribed lecture about artificial intelligence and machine learning fundamentals.",
      },
    });

    // Add document examples
    await prisma.document.create({
      data: {
        userId: user.id,
        title: "Project Requirements Document",
        content: "This document outlines the requirements for our new AI-powered application...",
        summary: "Project requirements for AI application development.",
      },
    });

    // Create additional chat for variety
    await prisma.chat.create({
      data: {
        userId: user.id,
        title: "Technical Discussion",
        messages: {
          create: [
            { role: "user", content: "Can you explain how neural networks work?" },
            {
              role: "assistant",
              content: "Neural networks are computing systems inspired by biological neural networks. They consist of layers of interconnected nodes that process information through learning rather than programming.",
            },
            { role: "user", content: "What are the different types of neural networks?" },
            {
              role: "assistant",
              content: "There are several types including feedforward networks, convolutional neural networks (CNNs), recurrent neural networks (RNNs), and transformer networks.",
            },
          ],
        },
      },
    });
  }

  console.log("✅ Realistic seed data inserted for all users!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });