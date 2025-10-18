// backend/src/backup-db.ts
// Run this script to export all data from your database

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function backupDatabase() {
  try {
    console.log('Starting database backup...');

    // Fetch all data from all tables
    const users = await prisma.user.findMany();
    const chats = await prisma.chat.findMany();
    const messages = await prisma.message.findMany();
    const imageGenerations = await prisma.imageGeneration.findMany();
    const audioJobs = await prisma.audioJob.findMany();
    const documents = await prisma.document.findMany();

    const backup = {
      timestamp: new Date().toISOString(),
      databaseUrl: process.env.DATABASE_URL,
      data: {
        users,
        chats,
        messages,
        imageGenerations,
        audioJobs,
        documents,
      },
      counts: {
        users: users.length,
        chats: chats.length,
        messages: messages.length,
        imageGenerations: imageGenerations.length,
        audioJobs: audioJobs.length,
        documents: documents.length,
      }
    };

    // Create backups directory if it doesn't exist
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    // Save backup as JSON
    const filename = `backup-${Date.now()}.json`;
    const filepath = path.join(backupDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

    console.log('\n✅ Backup completed successfully!');
    console.log(`📁 Backup saved to: ${filepath}`);
    console.log('\n📊 Data counts:');
    console.log(`   Users: ${backup.counts.users}`);
    console.log(`   Chats: ${backup.counts.chats}`);
    console.log(`   Messages: ${backup.counts.messages}`);
    console.log(`   Image Generations: ${backup.counts.imageGenerations}`);
    console.log(`   Audio Jobs: ${backup.counts.audioJobs}`);
    console.log(`   Documents: ${backup.counts.documents}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Backup failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

backupDatabase();