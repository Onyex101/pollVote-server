var express = require('express');
var bodyParser = require('body-parser');
var _ = require('lodash');
const { ObjectID } = require('mongodb');
var jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sgMail = require('@sendgrid/mail');

var { User } = require('./../../models/user');
var { Timer } = require('./../../misc/countdown');
var { authenticate } = require('./../../middleware/authentication');
var { Poll } = require('./../../models/poll');
var { Archive } = require('./../../models/archive');
var { PollList } = require('./../../models/pollList');
var { voteList } = require('./../../misc/voteList');
var notification = require('./../../firebase/push-notification');

var router = express.Router();
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

/**
 * Creates a new Admin
 */
router.post('/signup', (req, res) => {
    var body = _.pick(req.body, ['full_name', 'code', 'user_name', 'email', 'password', 'push_token']);
    var user = new User(body);
    user.save().then((user) => {
        return user.generateAuthToken();
    }).then((token) => {
        res.header('x-auth', token).send({ message: 'signup successfull' });
    }).catch((err) => {
        res.status(400).send(err);
    });
});


/**
 * login admin
 * public route
 */
router.post('/login', (req, res) => {
    var body = _.pick(req.body, ['user_name', 'password']);
    User.findByCredentials(body.user_name, body.password).then((user) => {
        user.generateAuthToken().then((token) => {
            res.header('x-auth', token).send({ message: 'login successfull' });
        });
    }).catch((err) => {
        res.status(400).send({ message: 'please check username or password' });
    });
});

/**
 * Admin Dashboard
 */
router.get('/home', authenticate, (req, res) => {
    var user = req.user;
    Poll.find({ _userID: user._id }).then((val) => {
        const data = { user, val, pending: user.pending, auth: user.authorised };
        res.send(data);
    })
});

/**
 * Create a new poll
 * 
 */
router.post('/new-poll', authenticate, (req, res) => {
    var date = req.body.duration;
    var newDate = new Date(date).getTime();
    newDate = newDate - (3600 * 1000);
    var now = new Date().getTime();
    // console.log('now date', now);
    // console.log('new date property', newDate);
    var archives = {
        startDate: now,
        endDate: newDate
    };
    if (newDate <= now) {
        res.send({ message: 'incorrect time' });
    };
    // convert time in milliseconds to seconds
    var a = newDate - now;
    var timeLeft = Math.floor((a / 1000));
    var body = {
        _userID: req.user._id,
        code: req.user.code,
        question: req.body.question,
        options: req.body.options,
        duration: timeLeft
    };
    var newPoll = new Poll(body);
    newPoll.save().then((poll) => {
        Timer(timeLeft, poll._id, archives);
        var poll_list = {
            _pollID: poll._id
        };
        var newList = new PollList(poll_list);
        newList.save().then((list) => {
            var payload = {
                notification: {
                    title: user_name + ' created a new poll',
                    body: "check it out"
                }
            };
            notification(payload);
            voteList(poll.code, poll._id);
        }).catch((e1) => {
            // console.log(e1);
        });
        res.send({ message: 'new poll created' });
    }).catch((err) => {
        res.status(400).send(err);
    });
});

/**
 * get all polls
 */
router.get('/all-polls', authenticate, (req, res) => {
    var id = req.user._id;
    Poll.find({ _userID: id }).then((polls) => {
        if (!polls) {
            res.send({ message: 'no poll found' });
        };
        res.send(polls);
    }).catch((err) => {
        res.status(400).send(err);
    })
});

/**
 * Delete poll
 */
router.delete('/delete/:id', (req, res) => {
    var id = req.params.id;
    if (!ObjectID.isValid(id)) {
        return res.status(404).send({ message: 'invalid id' });
    };
    Poll.findByIdAndDelete(id).then((poll) => {
        if (!poll) {
            res.send({
                message: 'Sorry, poll does not exist'
            });
        }
        res.send(poll);
    }).catch((err) => {
        res.status(400).send(err);
    });
});

/**
 * view pending users
 */
router.get('/pending', authenticate, (req, res) => {
    var id = req.user._id;
    User.findById(id).then((user) => {
        res.send(user.pending);
    }).catch((err) => {
        res.status(400).send(err);
    })
});

/**
 * convert pending voters to
 * authorized voters
 */
router.post('/pend-auth', authenticate, (req, res) => {
    var body = req.body;
    var id = req.user._id;
    var code = req.user.code;
    for (var i = 0; i < body.pending.length; i++) {
        var count = i;
        var pend = body.pending[i];
        User.updateOne({
            _id: id,
            pending: {
                $elemMatch: {
                    full_name: pend.full_name,
                    user_name: pend.user_name,
                    email: pend.email
                }
            }
        }, {
                $pull: {
                    pending: pend
                },
                $push: {
                    authorised: pend
                }
            }).then(() => {
            }).catch((e) => {
                console.log('e', e);
            });
        if (count === ((body.pending.length) - 1)) {
            Poll.findOne({code: code}).then((poll) => {
                voteList(poll.code, poll._id);
                res.send({ message: 'voter was succesfully authorized' });
            });
        }
    }
});

/**
 * view authorised users
 */
router.get('/authorised', authenticate, (req, res) => {
    var id = req.user._id;
    User.findById(id).then((user) => {
        res.send(user.authorised);
    }).catch((err) => {
        res.status(400).send({ err });
    });
});

/**
 * check current results
 */
router.get('/results', authenticate, (req, res) => {
    Poll.findOne({
        _userID: req.user._id,
        code: req.user.code
    }).then((poll) => {
        var data = poll.options;
        var a = 0;
        data.forEach((element) => {
            a += element.votes
        });
        var listObjects = [];
        data.forEach((element) => {
            var singleObj = {};
            singleObj['value'] = Math.round(((element.votes) / a) * 100);
            singleObj['votes'] = element.votes;
            singleObj['field'] = element.field;
            singleObj['_id'] = element._id;
            listObjects.push(singleObj);
        });
        // console.log(listObjects);
        var payload = {
            title: poll.question,
            id: poll._id,
            options: listObjects,
            duration: poll.duration
        };
        //pusher.trigger('vote-channel', 'new-entry', payload);
        res.send(payload);
    }).catch((e) => {
        res.status(400).send(e);
    });
})

/**
 * log out
 */
router.delete('/logout', authenticate, (req, res) => {
    req.user.removeToken(req.token).then((arr) => {
        res.send({
            message: 'Admin logged out'
        });
    }).catch((err) => {
        res.status(400).send({ err });
    });
});


/**
 * reset password
 */
router.post('/forgot-password', (req, res) => {
    const body = _.pick(req.body, ['email']);
    User.findOne({ email: body.email }).then((user) => {
        if (!user) {
            res.send({ message: 'No account with that email address exists' });
        } else {
            var payload = {
                _id: user._id,
                email: user.email
            };
            var secret = user.password + '-' + user.createdAt;
            var token = jwt.sign(payload, secret);
            // console.log('user token', token);
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            const msg = {
                to: user.email,
                from: 'pollVote-team@poll-vote.com',
                subject: 'Password Reset',
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    process.env.URI + '/admin/reset/' + user._id + '/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            };
            sgMail.send(msg).then((data) => {
                // console.log('success');
                res.send({ message: 'please check your mail' });
            }).catch((err) => {
                res.status(400).send(err);
            });
        }
    }).catch((e) => {
        res.status(400).send(e);
    });
});

router.get('/reset/:id/:token', (req, res) => {
    const id = req.params.id;
    const token = req.params.token;
    User.findById(id).then((user) => {
        if (!user) {
            return res.send({ message: 'incorrect id' });
        }
        var secret = user.password + '-' + user.createdAt;
        var decoded;
        try {
            var decoded = jwt.verify(token, secret);
        } catch (e) {
            return res.status(400).send(e);
        }
        res.render('reset-password.hbs', {
            id: decoded._id,
            token: token,
            user: 'admin'
        });
    }).catch((e) => {
        res.status(400).send(e);
    });
});


router.post('/reset', (req, res) => {
    var body = _.pick(req.body, ['id', 'token', 'password']);
    User.findById(body.id).then((user) => {
        if (!user) {
            res.send({ message: 'invalid user' });
        } else {
            var pass = body.password;
            bcrypt.compare(pass, user.password, (error, response) => {
                if (response) {
                    res.send({ message: 'please select a new password' })
                } else {
                    bcrypt.genSalt(10, (err, salt) => {
                        bcrypt.hash(pass, salt, (err, hash) => {
                            pass = hash;
                            User.findOneAndUpdate({ _id: user._id }, {
                                $set: {
                                    password: pass
                                }
                            }).then(() => {
                                res.send({ message: 'password updated' });
                            }).catch((e) => {
                                res.status(400).send({ e, pass });
                            });
                        });
                    });
                };
            });
        };
    }).catch((e) => {
        res.status(400).send(e);
    });
});

/**
 * Get Archived polls
 */
router.get('/archive', authenticate, (req, res) => {
    Archive.find({
        code: req.user.code
    }).then((archive) => {
        res.send({ archive });
    }).catch((err) => {
        res.status(400).send(err);
    });
});

/**
 * Display poll lists
 * (has voted and not voted)
 */
router.post('/lists', authenticate, (req, res) => {
    var body = _.pick(req.body, ['id']);
    PollList.findOne({
        _pollID: body.id
    }).then((list) => {
        if (!list) {
            res.status(400).send({ message: 'no list found' });
        };
        var payload = _.pick(list, ['notVoted', 'hasVoted']);
        res.send(payload);
    }).catch((err) => {
        res.status(400).send({ err });
    })
});

module.exports = router;