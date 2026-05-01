
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  const useSsl = (process.env.DATABASE_SSL ?? "false").toLowerCase() === "true";
  const migrationClient = postgres(process.env.DATABASE_URL, {
    ssl: useSsl ? "require" : false,
    max: 1,
  });
  const db = drizzle(migrationClient);
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete!");
  await migrationClient.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed!");
  console.error(err);
  process.exit(1);
});
