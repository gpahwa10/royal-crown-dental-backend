import express from 'express';
import cors from 'cors';
import authRoutes from "./modules/auth/auth.routes";
import employeesRoutes from "./modules/employees/employees.routes";
import clinicsRoutes from "./modules/clinics/clinics.routes";

export const app = express();
app.use(
    cors({
        origin: [
          "http://localhost:5173",
        ],
        allowedHeaders: ["Content-Type", "Authorization"],
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        credentials: true,
      })
);

app.use(express.json());
app.get('/health', (req, res) => {
    res.send('OK');
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/clinics", clinicsRoutes);