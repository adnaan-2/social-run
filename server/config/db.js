const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer = null;

const connectDB = async () => {
  try {
    let dbUrl = process.env.MONGODB_URI;

    // Use in-memory database in development if MONGODB_URI is not provided or is localhost
    if (
      process.env.NODE_ENV === 'development' ||
      !dbUrl ||
      dbUrl.includes('localhost') ||
      dbUrl.includes('127.0.0.1')
    ) {
      console.log('Starting in-memory MongoDB server...');
      mongoServer = await MongoMemoryServer.create();
      dbUrl = mongoServer.getUri();
      console.log(`In-memory MongoDB started at: ${dbUrl}`);
    }

    const conn = await mongoose.connect(dbUrl);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
      console.log('In-memory MongoDB stopped.');
    }
  } catch (error) {
    console.error('Error disconnecting database:', error);
  }
};

// Handle process termination to clean up in-memory DB
process.on('SIGTERM', async () => {
  await disconnectDB();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await disconnectDB();
  process.exit(0);
});

module.exports = connectDB;
