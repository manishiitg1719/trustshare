import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const sql = readFileSync(join(__dirname, "constraints.sql"), "utf8");

async function main() {
  for (const statement of sql.split(/^-- ;$/m).map((s) => s.trim()).filter(Boolean)) {
    await db.$executeRawUnsafe(statement);
  }
  console.log("Constraints applied");
}

main().finally(() => db.$disconnect());
