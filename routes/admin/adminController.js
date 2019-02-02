var express = require('express');
var bodyParser = require('body-parser');
var _ = require('lodash');
const { ObjectID } = require('mongodb');
var jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sgMail = require('@sendgrid/mail');
const async = require('async');

var { User } = require('./../../models/user');
var { authenticate } = require('./../../middleware/authentication');
var { Poll } = require('./../../models/poll');
const message = require('./../../misc/message');

var router = express.Router();
router.use(bodyParser.urlencoded({ extended: true }));
router.use(bodyParser.json());

/**
 * Creates a new Admin
 */
router.post('/signup', (req, res) => {
    var body = _.pick(req.body, ['full_name', 'code', 'user_name', 'email', 'password']);
    var user = new User(body);
    user.save().then((user) => {
        return user.generateAuthToken();
    }).then((token) => {
        res.header('x-auth', token).send({ message: message.admin.signUp });
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
            res.header('x-auth', token).send({ message: message.admin.login });
        });
    }).catch((err) => {
        res.status(400).send({ message: 'please check username or password' });
    });
});


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
    var body = {
        _userID: req.user._id,
        code: req.user.code,
        question: req.body.question,
        options: req.body.options
    };
    var newPoll = new Poll(body);
    newPoll.save().then((poll) => {
        res.send({ message: message.admin.poll });
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
    for (var i = 0; i < body.pending.length; i++) {
        var pend = body.pending[i];
        User.update({
            _id: id,
            pending: {
                $elemMatch: {
                    full_name: pend.full_name,
                    email: pend.email
                }
            }
        }, {
                $pull: {
                    pending: pend
                }
            }).then((user) => {
                if (!user) {
                    res.status(400).send({ error });
                }
                User.update({ _id: id }, {
                    $push: {
                        authorised: pend
                    }
                }).then(() => {
                    res.send({ message: 'voter was succesfully authorized' });
                }).catch((e) => {
                    res.status(400).send({ e });
                })
            }).catch((err) => {
                res.send(err);
            });
    }

})

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
            singleObj['value'] = Math.round(((element.votes)/a)*100);
            singleObj['votes'] = element.votes;
            singleObj['field'] = element.field;
            singleObj['_id'] = element._id;
            listObjects.push(singleObj);
        });
        res.send(listObjects);
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
router.post('/forgot-password', authenticate, (req, res) => {
    const body = _.pick(req.body, ['email']);
    User.findOne({ email: body.email }).then((user) => {
        if (!user) {
            res.send({message: 'No account with that email address exists'});
        } else {
            var payload = {
                _id: user._id,
                email: user.email
            };
            var secret = user.password + '-' + user.createdAt;
            var token = jwt.sign(payload, secret);
            console.log('user token', token);
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            const msg = {
                to: user.email,
                from: 'pollVote-team@gmail.com',
                subject: 'Password Reset',
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    process.env.URI + '/admin/reset/' + user._id + '/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
              };
            sgMail.send(msg).then((data) => {
                console.log('success');
                res.send({message: 'please check your mail'});
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
            return res.send({message: 'incorrect id'});
        }
        var secret = user.password + '-' + user.createdAt;
        var decoded;
        try {
            var decoded = jwt.verify(token, secret);
        } catch(e) {
            return res.status(400).send(e);
        }
        res.render('reset-password.hbs', {
            id: decoded._id,
            token: token
        });
    }).catch((e) => {
        res.status(400).send(e);
    });
});


router.post('/reset', (req, res) => {
    var body = _.pick(req.body, ['id', 'token', 'password']);
    async.waterfall([
        function (done) {
            User.findById(body.id).then((user) => {
                if (!user) {
                    done(err);
                };
                var pass = body.password;
                bcrypt.compare(pass, user.password, (err, res) => {
                    if (res) {
                        done(err);
                    } else {
                        done(null, user, pass);
                    };
                });
            })
        },
        function (user, pass, done) {
            bcrypt.genSalt(10, (err, salt) => {
                bcrypt.hash(pass, salt, (err, hash) => {
                    if (hash) {
                        pass = hash;
                        done(null, user, pass);
                    } else {
                        done(err);
                    }
                });
            });
        },
        function(user, pass, done) {
            User.findOneAndUpdate({_id: user._id}, {
                $push: {
                    password: pass
                }
            }).then(() => {
                done(null);
            }).catch((e) => {
                done(err);
            });
        }
    ], function (err, res) {
        if (res) {
            res.send({message: 'Your password has been successfully changed.'});
        } else {
            res.status(400).send({message: err});
        }
    })
})

module.exports = router;