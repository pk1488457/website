const mongoose = require('mongoose');

// Establishes connection to MongoDB and fails fast if it can't connect,
// so the app never runs silently against a dead DB.
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect is handled by the driver.');
    });

    return conn;
  } catch (err) {
    console.error(`MongoDB initial connection failed: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
