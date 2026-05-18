import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

const main = async () => {
    const sqlPath = join(process.cwd(), "drizzle/0005_purple_crystal.sql");
    const statements = readFileSync(sqlPath, "utf-8")
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    for (const statement of statements) {
        try {
            await pool.query(statement);
            console.log("OK:", statement.slice(0, 60).replace(/\s+/g, " "), "...");
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            if (
                message.includes("already exists") ||
                message.includes("duplicate") ||
                message.includes("does not exist")
            ) {
                console.log("SKIP:", message.slice(0, 80));
                continue;
            }
            throw error;
        }
    }

    await pool.end();
    console.log("Migration 0005 applied (or already present).");
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
