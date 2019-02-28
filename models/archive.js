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
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
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
    ],
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
}, {timestamps: true});

// archiveSchema.methods.toJSON = function () {
//     var archive = this;
//     var archiveObject = archive.toObject();
//     return _.pick(archiveObject, ['code', 'question', 'options', 'hasVoted', 'notVoted', 'startDate', 'endDate']);
// };

archiveSchema.pre('save', function (next) {
    var archive = this;
    date1 = new Date(archive.startDate).toString();
    archive.startDate = date1;
    date2 = new Date(archive.endDate).toString();
    archive.endDate = date2;
    next();
});

var Archive = mongoose.model('archives', archiveSchema);

module.exports = { Archive };