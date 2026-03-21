import "dotenv/config";
import cors from "cors";
import express from "express";

import { validateConfig, config } from "./config/index.js";
import { prisma } from "./db/prisma.js";
import { redis } from "./db/redis.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { authRoutes } from "./routes/authRoutes.js";
import { playerRoutes } from "./routes/playerRoutes.js";
import { logger } from "./utils/logger.js";

validateConfig();

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

/** Health probe used to verify both database and cache connectivity. */
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

app.use(errorHandler);

app.listen(config.port, () => {
  logger.info({ port: config.port }, "server listening");
});
