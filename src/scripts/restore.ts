import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

type RestoreOptions = {
  from?: string;
  dryRun: boolean;
  force: boolean;
};

function parseArgs(argv: string[]): RestoreOptions {
  const options: RestoreOptions = {
    from: undefined,
    dryRun: false,
    force: false,
  };

  for (const arg of argv) {
    if (arg.startsWith("--from=")) {
      options.from = arg.slice("--from=".length).trim();
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
    }
    if (arg === "--force") {
      options.force = true;
    }
  }

  return options;
}

async function resolveBackupDir(fromArg?: string): Promise<string> {
  if (fromArg) {
    return path.isAbsolute(fromArg) ? fromArg : path.resolve(process.cwd(), fromArg);
  }

  const basePath = path.resolve(process.cwd(), "backups", "mongodb");
  const entries = await fs.readdir(basePath, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  if (folders.length === 0) {
    throw new Error("No backup folders found in backups/mongodb");
  }

  return path.join(basePath, folders[0]);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeObjectId(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

function looksLikeIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value);
}

function shouldCastToObjectId(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return lowerKey === "_id" || lowerKey.endsWith("id") || lowerKey.endsWith("ids");
}

function shouldCastToDate(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return lowerKey.endsWith("at") || lowerKey.endsWith("date");
}

function restoreTypes(value: unknown, parentKey = ""): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => restoreTypes(item, parentKey));
  }

  if (isObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      result[key] = restoreTypes(nestedValue, key);
    }
    return result;
  }

  if (typeof value === "string") {
    if (shouldCastToObjectId(parentKey) && looksLikeObjectId(value)) {
      return new mongoose.Types.ObjectId(value);
    }

    if (shouldCastToDate(parentKey) && looksLikeIsoDate(value)) {
      return new Date(value);
    }
  }

  return value;
}

async function restoreBackup(options: RestoreOptions) {
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) {
    throw new Error("MONGODB_URI is not defined in .env or .env.local");
  }

  const backupDir = await resolveBackupDir(options.from);
  const files = await fs.readdir(backupDir, { withFileTypes: true });
  const jsonFiles = files
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && entry.name !== "manifest.json")
    .map((entry) => entry.name)
    .sort();

  if (jsonFiles.length === 0) {
    throw new Error(`No collection JSON files found in backup folder: ${backupDir}`);
  }

  await mongoose.connect(mongodbUri);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection is not available");
  }

  const preview: Array<{ collection: string; documents: number }> = [];

  for (const fileName of jsonFiles) {
    const collectionName = fileName.replace(/\.json$/i, "");
    const fullPath = path.join(backupDir, fileName);
    const raw = await fs.readFile(fullPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      throw new Error(`Expected an array in ${fileName}`);
    }

    preview.push({ collection: collectionName, documents: parsed.length });

    if (options.dryRun) {
      continue;
    }

    const collection = db.collection(collectionName);
    await collection.deleteMany({});

    if (parsed.length > 0) {
      const transformed = parsed.map((doc) => restoreTypes(doc)) as Record<string, unknown>[];
      await collection.insertMany(transformed, { ordered: false });
    }
  }

  return { backupDir, preview };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.dryRun && !options.force) {
    throw new Error(
      "Restore is destructive (it clears target collections first). Re-run with --force, or use --dry-run to preview.",
    );
  }

  const { backupDir, preview } = await restoreBackup(options);

  console.log(`📂 Backup source: ${backupDir}`);
  for (const item of preview) {
    console.log(`- ${item.collection}: ${item.documents} document(s)`);
  }

  if (options.dryRun) {
    console.log("🧪 Dry run completed. No data was modified.");
  } else {
    console.log("✅ Restore completed.");
  }
}

main()
  .catch((error) => {
    console.error("❌ Restore failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
