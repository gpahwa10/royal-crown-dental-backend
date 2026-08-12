import "dotenv/config";
import { execSync } from "child_process";

const run = (script: string) => {
    console.log(`\n>> npm run ${script}\n`);
    execSync(`npm run ${script}`, { stdio: "inherit", env: process.env });
};

const main = () => {
    run("seed:clinics");
    run("seed:services");
    run("seed:inventory");
    run("seed:employees");
    run("seed:dev");
    console.log("\nAll seeds completed.");
};

main();
