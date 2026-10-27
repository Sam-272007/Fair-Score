import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true }
  },
  { _id: true }
);

const judgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    token: { type: String, required: true },
    assignedTeamIds: { type: [String], default: [] }
  },
  { _id: true }
);

const eventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['setup', 'scoring', 'locked', 'published'],
      default: 'setup'
    },
    scoringScale: {
      min: { type: Number, default: 1 },
      max: { type: Number, default: 10 }
    },
    assignmentMode: {
      type: String,
      enum: ['all', 'k_judges'],
      default: 'all'
    },
    k: {
      type: Number,
      default: null
    },
    adminTokenHash: {
      type: String,
      required: true,
      select: false // Never leak admin token hash in regular queries
    },
    teams: [teamSchema],
    judges: [judgeSchema]
  },
  {
    timestamps: true
  }
);

// Method to verify admin token with timingSafeEqual
eventSchema.methods.verifyAdminToken = function (token) {
  // compare SHA-256 hash using crypto.timingSafeEqual
};

export const Event = mongoose.model('Event', eventSchema);
