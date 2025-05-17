const express = require("express");
const authRoutes = require("./routes/auth");
const personalRoutes = require("./routes/personal");
const resultsRoutes = require("./routes/results");
const hallticketRoutes = require("./routes/hallticket");

const app = express();
app.use(express.json());

// Use routes
app.use("/api", authRoutes);
app.use("/api", personalRoutes);
app.use("/api", resultsRoutes);
app.use("/api", hallticketRoutes);
app.use("/api", authRoutes);


const PORT = process.env.PORT || 9000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
