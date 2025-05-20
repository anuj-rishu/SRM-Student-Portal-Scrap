require("dotenv").config();
const express = require("express");
const authMiddleware = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const personalRoutes = require("./routes/personal");
const resultsRoutes = require("./routes/results");
const hallticketRoutes = require("./routes/hallticket");

const app = express();
app.use(express.json());

// Public routes
app.use("/api", authRoutes);

// Protected routes
app.use("/api", authMiddleware, personalRoutes);
app.use("/api", authMiddleware, resultsRoutes);
app.use("/api", authMiddleware, hallticketRoutes);

const PORT = process.env.PORT || 9000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);