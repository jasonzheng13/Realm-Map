import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import pool from "./config/database";
import authRoutes from "./routes/auth";
import waypointRoutes from './routes/waypoints';
import realmRoutes from './routes/realm';

dotenv.config();

// Creates app
const app = express();  
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get("/api/health", (req: express.Request, res: express.Response) => {
  res.json({ status: "ok", message: "RealmMap server is running" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use('/api/waypoints', waypointRoutes);
app.use('/api/realms', realmRoutes);

// Socket.IO connection
io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;

// Test database connection
pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("Database connected at:", res.rows[0].now);
  }
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

