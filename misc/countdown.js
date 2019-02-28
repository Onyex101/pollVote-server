const { Poll } = require('./../models/poll');
const { PollList } = require('./../models/pollList');
const { Archive } = require('./../models/archive');

var Timer = (period, pollID, duration) => {
    var x = setInterval(() => {
        console.log('timeLeft', period);
        Poll.findOneAndUpdate({_id: pollID}, {
            $set: {
                duration: period
            }
        }).then(() => {
            console.log('duration updated');
        }).catch((err) => {
            console.log(err);
        });
        period--;
        if (period <= 1) {
            Poll.findByIdAndRemove(pollID).then((poll) => {
                PollList.findOneAndRemove({_pollID: poll._id}).then((list) => {
                    var body = {
                        _userID: poll._userID,
                        code: poll.code,
                        question: poll.question,
                        options: poll.options,
                        notVoted: list.notVoted,
                        hasVoted: list.hasVoted,
                        startDate: duration.startDate,
                        endDate: duration.endDate
                    };
                    var newArchive = new Archive(body);
                    newArchive.save().then((arch) => {
                        console.log('archive successfully saved', arch);
                    }).catch((e) => {
                        console.log('archive error', e);
                    });
                });
            });
            clearInterval(x);
        };
    }, 1000);
};

module.exports = { Timer };












