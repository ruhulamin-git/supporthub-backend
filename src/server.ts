import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { WebSocketService } from './services/websocket.service';
import authRoutes from './routes/auth.routes';
import ticketRoutes from './routes/ticket.routes';
import dashboardRoutes from './routes/dashboard.routes';

dotenv.config();

const rawFrontendUrl = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.trim().replace(/\/+$/, '') : '';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

const allowedOrigins = rawFrontendUrl
  ? [rawFrontendUrl, 'http://localhost:3000', 'http://localhost:5173']
  : true;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// Initialize WebSocket service
WebSocketService.initialize(io);

// Middleware
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/dashboard', dashboardRoutes);

// WebSocket connection handling
io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

// Make io available to routes
app.set('io', io);

// Start server
httpServer.listen(PORT);

export { app, io };
