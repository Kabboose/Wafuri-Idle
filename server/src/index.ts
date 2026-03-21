import "dotenv/config";
import cors from "cors";
import express from "express";

import { validateConfig, config } from "./config/index.js";
import { prisma } from "./db/prisma.js";
import { redis } from "./db/redis.js";
import { authRoutes } from "./routes/authRoutes.js";
import { playerRoutes } from "./routes/playerRoutes.js";

validateConfig();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", async (_request, response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    response.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.use("/auth", authRoutes);
app.use(playerRoutes);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Internal server error";
  response.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});
