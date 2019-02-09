const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
const secret = process.env.JWT_SECRET;

var voterSchema = new mongoose.Schema({
    full_name: {
        type: String,
        required: true
    },
    user_name: {
        type: String,
        unique: true,
        required: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        minlenght: 1,
        unique: true,
        validate: {
            validator: validator.isEmail,
            massage: '{value} is not a valid email'
        }
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    push_token: {
        type: String,
        default: null
    },
    tokens: [{
        access: {
            type: String,
            required: true
        },
        token: {
            type: String,
            required: true
        }
    }]
}, { timestamps: true });

/**
 * overrides a method to limit the amount of info
 * from db that is being returned to the user
 */
voterSchema.methods.toJSON = function () {
    var voter = this;
    var voterObject = voter.toObject();
    return _.pick(voterObject, ['_id', 'user_name', 'email']);
};

// Instance methods
voterSchema.methods.generateAuthToken = function () {
    var voter = this;
    var access = 'auth';
    var load = {
        _id: voter._id.toHexString(),
        access: access,
        exp: Math.floor(Date.now() / 1000) + (60 * 60)
    };
    var token = jwt.sign(load, secret).toString();
    voter.tokens.push({ access, token });
    return voter.save().then(() => {
        return token;
    });
};

voterSchema.methods.removeToken = function (token) {
    var voter = this;
    return voter.updateOne({
        $pull: {
            tokens: { token }
        }
    });
};

/**
 * Model method
 */
voterSchema.statics.findByToken = function (token) {
    var Voter = this;
    var decoded;
    try {
        decoded = jwt.verify(token, secret);
    } catch (e) {
        return Promise.reject();
    };
    return Voter.findOne({
        '_id': decoded._id,
        'tokens.token': token,
        'tokens.access': 'auth'
    });
};

voterSchema.statics.findByCredentials = function (userName, pass) {
    var Voter = this;
    return Voter.findOne({ user_name: userName }).then((data) => {
        if (!data) {
            return Promise.reject('no user');
        };
        return new Promise((resolve, reject) => {
            bcrypt.compare(pass, data.password, (err, res) => {
                if (res) {
                    resolve(data);
                } else {
                    reject(err);
                };
            });
        });
    });
};

voterSchema.pre('save', function (next) {
    var voter = this;
    if (voter.isModified('password')) {
        bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(voter.password, salt, (err, hash) => {
                voter.password = hash;
                next();
            });
        });
    } else {
        next();
    }
});

var Voter = mongoose.model('voter', voterSchema);

module.exports = { Voter };