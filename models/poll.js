var mongoose = require('mongoose');
var _ = require('lodash');

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
    duration: {
        type: Number,
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

pollSchema.methods.toJSON = function () {
    var poll = this;
    var pollObject = poll.toObject();
    return _.pick(pollObject, ['_id', 'question', 'options', 'duration']);
};

var Poll = mongoose.model('poll', pollSchema);

module.exports = { Poll };