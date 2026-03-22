import "dotenv/config";
import cors from "cors";
import express from "express";

import { validateConfig, config } from "./config/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { authRoutes } from "./routes/authRoutes.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { openApiRoutes } from "./routes/openApiRoutes.js";
import { playerRoutes } from "./routes/playerRoutes.js";
import { logger } from "./utils/logger.js";

validateConfig();

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.use(healthRoutes);
app.use(openApiRoutes);
app.use("/auth", authRoutes);
app.use(playerRoutes);

app.use(errorHandler);

app.listen(config.port, () => {
  logger.info({ port: config.port }, "server listening");
});
