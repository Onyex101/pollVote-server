var express = require('express');
var bodyParser = require('body-parser');
var _ = require('lodash');
const { ObjectID } = require('mongodb');
const pusher = require('./../../misc/pusher');
const sgMail = require('@sendgrid/mail');

const { voteAuth } = require('./../../middleware/voter-auth');
const { Voter } = require('./../../models/voter');
const { Poll } = require('./../../models/poll');
const { User } = require('./../../models/user');
const { PollList } = require('./../../models/pollList');

var router = express.Router();
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

/**
 * Add a user
 */
router.post('/signup', (req, res) => {
    var body = _.pick(req.body, ['full_name', 'user_name', 'email', 'password', 'push_token']);
    var voter = new Voter(body);
    voter.save().then((voter) => {
        return voter.generateAuthToken();
    }).then((token) => {
        res.header('x-auth', token).send({ voter });
    }).catch((err) => {
        res.status(400).send(err);
    });
});

/**
 * login voter
 */
router.post('/login', (req, res) => {
    var body = _.pick(req.body, ['user_name', 'code', 'password']);
    Voter.findByCredentials(body.user_name, body.password).then((voter) => {
        voter.generateAuthToken().then((token) => {
            User.find({
                code: body.code,
                authorised: {
                    $elemMatch: {
                        full_name: voter.full_name,
                        user_name: voter.user_name,
                        email: voter.email
                    }
                }
            }).then((user) => {
                let test = _.isEmpty(user);
                if ((test === true)) {
                    User.findOne({
                        code: body.code,
                        pending: {
                            $elemMatch: {
                                full_name: voter.full_name,
                                user_name: voter.user_name,
                                email: voter.email
                            }
                        }
                    }).then((pend) => {
                        let test2 = _.isEmpty(pend);
                        if (test2 === true) {
                            User.update({ code: body.code }, {
                                $push: {
                                    pending: {
                                        full_name: voter.full_name,
                                        user_name: voter.user_name,
                                        email: voter.email
                                    }
                                }
                            }).then(() => {
                                res.header('x-auth', token).send(voter);
                            });
                        } else {
                            res.header('x-auth', token).send(voter);
                        }
                    }).catch((e) => res.status(400).send);
                } else {
                    res.header('x-auth', token).send(voter);
                }
            }).catch((e) => {
                res.status(400).send({ e });
            })
        });
    }).catch((err) => {
        res.status(400).send({ err });
    });
});

/**
 * get question
 */
router.post('/get-code', voteAuth, (req, res) => {
    var code = _.pick(req.body, ['code']);
    User.find(
        {
            code: code.code,
            authorised: {
                $elemMatch: {
                    full_name: req.voter.full_name,
                    user_name: req.voter.user_name
                }
            }
        }
    ).then((val) => {
        let test = _.isEmpty(val);
        if (test === true) {
            res.send({ message: 'No authorization' });
        } else {
            Poll.findOne({ code: code.code }).then((poll) => {
                if (!poll) {
                    res.status(400).send({ message: 'no poll' });
                };
                PollList.findOne({
                    _pollID: poll._id,
                    hasVoted: {
                        $elemMatch: {
                            full_name: req.voter.full_name,
                            user_name: req.voter.user_name
                        }
                    }
                }).then((pl) => {
                    let test = _.isEmpty(pl);
                    if (test === false) {
                        res.send({ message: 'Already Voted!' });
                    } else {
                        res.send(poll);
                    }
                }).catch((e) => {
                    res.status(400).send(e);
                })
            }).catch((err) => {
                res.status(400).send(err);
            });
        }
    }).catch((e) => {
        res.status(400).send({ e });
    });
});

/**
 * send selected option
 */
router.post('/poll', voteAuth, (req, res) => {
    var body = _.pick(req.body, ['_id', 'code']);
    User.findOne({
        code: body.code,
        authorised: {
            $elemMatch: {
                full_name: req.voter.full_name,
                user_name: req.voter.user_name
            }
        }
    }).then((u) => {
        let test2 = _.isEmpty(u);
        if (test2 === true) {
            res.send({ message: 'no authorisation' });
        } else {
            Poll.findOne({
                code: body.code
            }).then((poll) => {
                PollList.findOne({
                    _pollID: poll._id,
                    hasVoted: {
                        $elemMatch: {
                            full_name: req.voter.full_name,
                            user_name: req.voter.user_name
                        }
                    }
                }).then((pl) => {
                    let test = _.isEmpty(pl);
                    if (test === false) {
                        res.status(400).send({ message: 'Already Voted!' });
                    } else {
                        Poll.findOneAndUpdate({
                            code: body.code,
                            'options._id': body._id
                        }, {
                                $inc: {
                                    "options.$.votes": 1
                                }
                            }).then(() => {
                                PollList.findOneAndUpdate({
                                    _pollID: poll._id,
                                    notVoted: {
                                        $elemMatch: {
                                            full_name: req.voter.full_name,
                                            user_name: req.voter.user_name
                                        }
                                    }
                                }, {
                                        $pull: {
                                            notVoted: {
                                                full_name: req.voter.full_name,
                                                user_name: req.voter.user_name
                                            }
                                        },
                                        $push: {
                                            hasVoted: {
                                                full_name: req.voter.full_name,
                                                user_name: req.voter.user_name,
                                            }
                                        }
                                    }).then(() => {
                                        Poll.findOne({
                                            code: body.code
                                        }).then((p) => {
                                            var data = p.options;
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
                                            var payload = { title: p.question, options: listObjects, duration: p.duration };
                                            pusher.trigger(poll.code, 'new-entry', payload);
                                            res.send(payload);
                                        }).catch((e4) => {
                                            res.status(400).send({ e3 });
                                        });
                                    }).catch((e3) => {
                                        res.status(400).send({ e3 });
                                    });
                            }).catch((err) => res.status(400).send({ err }));
                    }
                }).catch((e1) => {
                    res.status(400).send({ e1 })
                })
            }).catch((e) => {
                res.status(400).send({ e });
            });
        }
    }).catch((error) => {
        res.status(400).send({ error });
    });
});

router.post('/results', voteAuth, (req, res) => {
    var body = _.pick(req.body, ['code']);
    Poll.findOne({
        code: body.code
    }).then((poll) => {
        console.log(poll);
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
        var payload = { title: poll.question, options: listObjects, duration: poll.duration };
        pusher.trigger(poll.code, 'new-entry', payload);
        res.send(payload);
    }).catch((e) => {
        res.status(400).send(e);
    });
})

/**
 * logout
 */
router.delete('/logout', voteAuth, (req, res) => {
    req.voter.removeToken(req.token).then(() => {
        res.send({
            message: 'voter logged out'
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
    Voter.findOne({ email: body.email }).then((voter) => {
        if (!voter) {
            res.send({ message: 'No account with that email address exists' });
        } else {
            var payload = {
                _id: voter._id,
                email: voter.email
            };
            var secret = voter.password + '-' + voter.createdAt;
            var token = jwt.sign(payload, secret);
            console.log('voter token', token);
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            const msg = {
                to: voter.email,
                from: 'pollVote-team@poll-vote.com',
                subject: 'Password Reset',
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    process.env.URI + '/admin/reset/' + voter._id + '/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            };
            sgMail.send(msg).then(() => {
                console.log('success');
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
    Voter.findById(id).then((voter) => {
        if (!voter) {
            return res.send({ message: 'incorrect id' });
        }
        var secret = voter.password + '-' + voter.createdAt;
        var decoded;
        try {
            var decoded = jwt.verify(token, secret);
        } catch (e) {
            return res.status(400).send(e);
        }
        res.render('reset-password.hbs', {
            id: decoded._id,
            token: token,
            user: 'user'
        });
    }).catch((e) => {
        res.status(400).send(e);
    });
});


router.post('/reset', (req, res) => {
    var body = _.pick(req.body, ['id', 'token', 'password']);
    Voter.findById(body.id).then((voter) => {
        if (!voter) {
            res.send({ message: 'voter does not exist' });
        } else {
            var pass = body.password;
            bcrypt.compare(pass, voter.password, (error, response) => {
                if (response) {
                    res.send({ message: 'please select a new password' })
                } else {
                    bcrypt.genSalt(10, (err, salt) => {
                        bcrypt.hash(pass, salt, (err, hash) => {
                            pass = hash;
                            Voter.findOneAndUpdate({ _id: voter._id }, {
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

module.exports = router;
