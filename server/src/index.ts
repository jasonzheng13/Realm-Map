import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import pool from "./config/database";
import authRoutes from "./routes/auth";
import createWaypointsRouter from './routes/waypoints';
import realmRoutes from './routes/realm';
import jwt from 'jsonwebtoken';

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
app.use('/api/waypoints', createWaypointsRouter(io));
app.use('/api/realms', realmRoutes);

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if(!token) return next(new Error('Authentication error'));

  try{
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      username: string;
    };
    socket.data.userID = decoded.id;
    socket.data.username = decoded.username;
    next();
  }catch{
    next(new Error('Invalid token'));
  }
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.data.username}`);

  socket.on("join-realm", async({realmID}: {realmID: string}) => {
    const result = await pool.query(
      'SELECT * FROM realm_members WHERE realm_id = $1 AND user_id = $2',
      [realmID, socket.data.userID]
    );
    if(result.rows.length === 0){
      socket.emit('error', {message: 'Not a member of this realm'});
      return;
    }
    socket.join(realmID);
    socket.emit('joined-realm', {realmID});
    console.log(`${socket.data.username} joined realm ${realmID}`);
  });

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

