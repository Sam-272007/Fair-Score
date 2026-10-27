import mongoose from 'mongoose';

const scoreSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true
    },
    judgeId: {
      type: String,
      required: true
    },
    teamId: {
      type: String,
      required: true
    },
    value: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index so a judge can only have one score per team per event (upsert prevents duplicates)
scoreSchema.index({ eventId: 1, judgeId: 1, teamId: 1 }, { unique: true });

export const Score = mongoose.model('Score', scoreSchema);
