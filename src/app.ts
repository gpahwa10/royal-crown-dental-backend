import express from 'express';
import cors from 'cors';
import authRoutes from './modules/auth/auth.routes';

export const app = express();
app.use(
    cors({
        origin: [
          "http://localhost:51741",
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

app.use('/api/auth', authRoutes);