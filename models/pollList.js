var mongoose = require('mongoose');

var pollListSchema = new mongoose.Schema({
    _pollID: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    notVoted: [
        {
            full_name: {
                type: String
            },
            user_name: {
                type: String
            }
        }
    ],
    hasVoted: [
        {
            full_name: {
                type: String
            },
            user_name: {
                type: String
            }
        }
    ]
}, { timestamps: true });

var PollList = mongoose.model('pollList', pollListSchema);

module.exports = { PollList };