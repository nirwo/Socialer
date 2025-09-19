import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Import configuration
import env from './config/env.js';
import { prisma, redis } from './config/database.js';

// Import middleware
import { generalLimiter } from './middleware/rateLimiter.js';
import { authenticate } from './middleware/auth.js';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import postRoutes from './routes/posts.js';

const app = express();
const server = createServer(app);

// Initialize Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: env.CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS configuration
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(generalLimiter);

// Static files
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Socialer API is running',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    // Verify token and get user
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatar: true
      }
    });

    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user.id;
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User ${socket.user.username} connected (${socket.id})`);

  // Join user to their own room for personal notifications
  socket.join(`user_${socket.userId}`);

  // Handle joining specific rooms (like post comments)
  socket.on('join_post', (postId) => {
    socket.join(`post_${postId}`);
  });

  socket.on('leave_post', (postId) => {
    socket.leave(`post_${postId}`);
  });

  // Handle real-time messaging
  socket.on('send_message', async (data) => {
    try {
      const { receiverId, content, mediaUrl, mediaType } = data;

      // Create message in database
      const message = await prisma.message.create({
        data: {
          content,
          senderId: socket.userId,
          receiverId,
          mediaUrl,
          mediaType
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          }
        }
      });

      // Send to receiver
      io.to(`user_${receiverId}`).emit('new_message', message);

      // Send confirmation to sender
      socket.emit('message_sent', { messageId: message.id });
    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing_start', (receiverId) => {
    io.to(`user_${receiverId}`).emit('user_typing', {
      userId: socket.userId,
      username: socket.user.username
    });
  });

  socket.on('typing_stop', (receiverId) => {
    io.to(`user_${receiverId}`).emit('user_stopped_typing', {
      userId: socket.userId
    });
  });

  // Handle real-time notifications for posts
  socket.on('post_liked', (data) => {
    const { postId, authorId } = data;
    io.to(`user_${authorId}`).emit('notification', {
      type: 'like',
      message: `${socket.user.firstName} ${socket.user.lastName} liked your post`,
      postId,
      user: socket.user
    });
  });

  socket.on('post_commented', (data) => {
    const { postId, authorId, commentId } = data;
    io.to(`user_${authorId}`).emit('notification', {
      type: 'comment',
      message: `${socket.user.firstName} ${socket.user.lastName} commented on your post`,
      postId,
      commentId,
      user: socket.user
    });
  });

  socket.on('disconnect', () => {
    console.log(`User ${socket.user.username} disconnected (${socket.id})`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      message: 'File size exceeds the limit of 10MB'
    });
  }

  if (err.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: err.message
    });
  }

  res.status(err.status || 500).json({
    error: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    message: env.NODE_ENV === 'production' ? 'Something went wrong' : err.stack
  });
});

// Handle 404 routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');

  server.close(() => {
    console.log('HTTP server closed');
  });

  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');

  server.close(() => {
    console.log('HTTP server closed');
  });

  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
});

// Start server
server.listen(env.PORT, () => {
  console.log(`🚀 Socialer server running on port ${env.PORT}`);
  console.log(`📖 API documentation available at http://localhost:${env.PORT}/health`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
});

export default app;