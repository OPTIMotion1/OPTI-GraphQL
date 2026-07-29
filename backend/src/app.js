const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const assetsRoutes = require("./routes/assets.routes");
const commandRoutes = require("./routes/command.routes");
const activityRoutes = require("./routes/activity.routes");
const autoCutoffRoutes = require("./routes/auto-cutoff.routes");

const app = express();

app.use(cors());
app.use(express.json());

// Rate limiting for API routes
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // max 100 requests per minute per IP
  message: 'Too many requests. Please try again later.'
});

const commandLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // max 10 commands per minute per IP
  message: 'Too many commands. Please wait before sending more commands.'
});

// Apply rate limiting
app.use("/api/", apiLimiter);
app.use("/api/command", commandLimiter);

// Routes
app.use("/api/auth", authRoutes);  // Login, logout - NO AUTH REQUIRED
app.use("/api/assets", assetsRoutes);  // Requires auth
app.use("/api/command", commandRoutes);  // Requires auth + role check
app.use("/api/activity", activityRoutes);  // Requires auth
app.use("/api/auto-cutoff", autoCutoffRoutes);  // Requires auth + admin role

// Health check — useful for confirming GraphQL login works on startup
app.get("/api/health", async (req, res) => {
  try {
    const { login } = require("./services/voltcred.service");
    await login();
    res.json({ success: true, message: "GraphQL login OK" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve built frontend in production
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");
if (require("fs").existsSync(frontendDist)) {
  app.use(express.static(frontendDist));

  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
      return next();
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  app.get("/", (req, res) => res.json({ success: true, message: "OPTI GraphQL Backend Running" }));
}

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`OPTI GraphQL backend running on port ${PORT}`));
