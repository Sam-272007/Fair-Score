import mongoose from 'mongoose';

export async function connectDB(uri) {
  if (!uri) {
    console.warn('[DB] MONGODB_URI not provided.');
    return;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('[DB] Connected to MongoDB successfully');
  } catch (err) {
    console.error('[DB] Failed to connect to MongoDB:', err.message);
  }
}

export function isDbConnected() {
  return mongoose.connection.readyState === 1;
}
