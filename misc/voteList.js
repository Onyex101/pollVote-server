const { PollList } = require('./../models/pollList');
const { User } = require('./../models/user');

var voteList = (code, pollId) => {
    console.log('votelist info', code, pollId);
    User.findOne({code: code}).then((user) => {
        console.log('authorised list no:', user.authorised.length);
        if (user.authorised.length !== 0) {
            var auth = user.authorised;
            auth.forEach((element) => {
                PollList.findOneAndUpdate({
                    _pollID: pollId
                }, {
                    $push: {
                        notVoted: {
                            full_name: element.full_name,
                            user_name: element.user_name
                        }
                    }
                }).then(() => {
                    console.log('success');
                }).catch((er) => {
                    console.log('40:', er);
                });
            });
        };
    }).catch((e) => {
        console.log(e);
    });
};

module.exports = { voteList };
