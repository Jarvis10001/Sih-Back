const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import middleware
const { logger } = require('./middleware/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Import routes
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Custom middleware
app.use(logger);

// Routes
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'Welcome to SIH Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      users: '/api/users',
      documentation: 'Available endpoints: GET, POST, PUT, DELETE /api/users'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK', 
    message: 'Backend server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/users', usersRoutes);

// Sample data route (for testing)
app.get('/api/data', (req, res) => {
  res.json({ 
    success: true,
    message: 'Sample data retrieved successfully',
    data: [
      { id: 1, name: 'Sample Data 1', type: 'example' },
      { id: 2, name: 'Sample Data 2', type: 'demo' }
    ]
  });
});

// Error handling middleware (must be after all routes)
app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`👥 Users API: http://localhost:${PORT}/api/users`);
});