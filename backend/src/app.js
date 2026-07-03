const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const assetsRoutes = require("./routes/assets.routes");
const commandRoutes = require("./routes/command.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.json({ success: true, message: "OPTI GraphQL Backend Running" }));

app.use("/api/assets", assetsRoutes);
app.use("/api/command", commandRoutes);

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
  app.get("/{*path}", (req, res) => res.sendFile(path.join(frontendDist, "index.html")));
}

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`OPTI GraphQL backend running on port ${PORT}`));
