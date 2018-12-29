var mongoose = require('mongoose');

var pollSchema = new mongoose.Schema({
    _userID: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    code: {
        type: String,
        required: true
    },
    question: {
        type: String,
        required: true
    },
    options: [
        {
            field: {
                type: String,
                required: true
            },
            votes: {
                type: Number,
                default: 0
            }
        }
    ]
}, { timestamps: true });

var Poll = mongoose.model('poll', pollSchema);

module.exports = { Poll };