import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function createTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

async function backupMongoDb() {
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) {
    throw new Error("MONGODB_URI is not defined in .env or .env.local");
  }

  const timestamp = createTimestamp();
  const backupDir = path.resolve(process.cwd(), "backups", "mongodb", timestamp);
  await fs.mkdir(backupDir, { recursive: true });

  await mongoose.connect(mongodbUri);
  const db = mongoose.connection.db;

  if (!db) {
    throw new Error("MongoDB connection is not available");
  }

  const collections = await db.listCollections().toArray();
  const manifest: Array<{ collection: string; documents: number; file: string }> = [];

  for (const collectionInfo of collections) {
    const collectionName = collectionInfo.name;
    const docs = await db.collection(collectionName).find({}).toArray();
    const fileName = `${collectionName}.json`;
    const filePath = path.join(backupDir, fileName);

    await fs.writeFile(filePath, JSON.stringify(docs, null, 2), "utf8");
    manifest.push({
      collection: collectionName,
      documents: docs.length,
      file: fileName,
    });
  }

  const manifestPath = path.join(backupDir, "manifest.json");
  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        database: mongoose.connection.name,
        collections: manifest,
      },
      null,
      2,
    ),
    "utf8",
  );

  return { backupDir, collectionCount: manifest.length };
}

backupMongoDb()
  .then(({ backupDir, collectionCount }) => {
    console.log(`✅ Backup completed: ${backupDir}`);
    console.log(`📦 Exported ${collectionCount} collection(s)`);
  })
  .catch((error) => {
    console.error("❌ Backup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
