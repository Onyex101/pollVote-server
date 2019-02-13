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
    ]
}, {timestamps: true});

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