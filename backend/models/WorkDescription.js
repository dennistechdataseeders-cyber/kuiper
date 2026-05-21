const mongoose = require('mongoose');

const workDescriptionSchema =
  new mongoose.Schema(
    {

      developer: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },

      feed: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: 'Feed',
        required: true
      },

      description: {
        type: String,
        required: true
      },

      date: {
        type: String,
        required: true
      }

    },
    {
      timestamps: true
    }
  );

module.exports =
  mongoose.models.WorkDescription ||
  mongoose.model(
    'WorkDescription',
    workDescriptionSchema
  );