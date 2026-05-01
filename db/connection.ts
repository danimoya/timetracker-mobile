import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable must be set");
}

let client: ReturnType<typeof postgres> | null = null;

export const createPool = () => {
  if (client) return client;
  const useSsl = (process.env.DATABASE_SSL ?? "false").toLowerCase() === "true";
  client = postgres(process.env.DATABASE_URL!, {
    ssl: useSsl ? "require" : false,
    max: 10,
    idle_timeout: 30,
    connect_timeout: 10,
    debug: process.env.DB_DEBUG
      ? (_c, q, _p) => console.log("[pg-sql]", q.slice(0, 400))
      : undefined,
  });
  return client;
};
