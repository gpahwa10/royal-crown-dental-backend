import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
    throw new Error(
        "DATABASE_URL is not set. Add it to .env or your environment."
    );
}

const connectionString = process.env.DATABASE_URL;
const isLocalhost =
    /@localhost(?::|\/|$)/i.test(connectionString) ||
    /@127\.0\.0\.1(?::|\/|$)/i.test(connectionString);

const pool = new Pool({
    connectionString,
    ...(isLocalhost
        ? {}
        : {
              ssl: {
                  rejectUnauthorized: false,
              },
          }),
});

export const db = drizzle(pool);