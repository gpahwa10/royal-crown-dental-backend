import "dotenv/config";
import { app } from "./app";
import { assertConfiguredClinicExists } from "./config/clinic.bootstrap";

const PORT = process.env.PORT || 4000;

assertConfiguredClinicExists()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        process.exit(1);
    });
