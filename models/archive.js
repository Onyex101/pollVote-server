var mongoose = require('mongoose');

var archiveSchema = new mongoose.Schema({
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
    duration: {
        type: Number
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
}, {timestamps: true});

var Archive = mongoose.model('archives', archiveSchema);

module.exports = { Archive };