const mongoose = require('mongoose');
const validator = require('validator');
const jwt = require('jsonwebtoken');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
const secret = process.env.JWT_SECRET;

var userSchema = new mongoose.Schema({
    full_name: {
        type: String,
        required: true,
        unique: true
    },
    code: {
        type: String,
        minlength: 5,
        unique: true,
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
    pending: [{
        full_name: {
            type: String
        },
        user_name: {
            type: String
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
        }
    }],
    authorised: [{
        full_name: {
            type: String
        },
        user_name: {
            type: String
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
        }
    }],
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
// userSchema.methods.toJSON = function () {
//     var user = this;
//     var userObject = user.toObject();
//     return _.pick(userObject, ['_id', 'user_name', 'email', 'pending', 'authorised']);
// };

// Instance methods
userSchema.methods.generateAuthToken = function () {
    var user = this;
    var access = 'auth';
    var load = {
        _id: user._id.toHexString(),
        access: access,
        exp: Math.floor(Date.now() / 1000) + (60 * 60)
    };
    var token = jwt.sign(load, secret).toString();
    user.tokens.push({ access, token });
    return user.save().then(() => {
        return token;
    });
};

userSchema.methods.removeToken = function (token) {
    var user = this;
    return user.updateOne({
        $pull: {
            tokens: { token }
        }
    });
};

/**
 * Model method
 */
userSchema.statics.findByToken = function (token) {
    var User = this;
    var decoded;
    try {
        decoded = jwt.verify(token, secret);
    } catch (e) {
        return Promise.reject();
    };
    return User.findOne({
        '_id': decoded._id,
        'tokens.token': token,
        'tokens.access': 'auth'
    });
};

userSchema.statics.findByCredentials = function (userName, pass) {
    var User = this;
    return User.findOne({ user_name: userName }).then((user) => {
        if (!user) {
            return Promise.reject('no user');
        };
        return new Promise((resolve, reject) => {
            bcrypt.compare(pass, user.password, (err, res) => {
                if (res) {
                    resolve(user);
                } else {
                    reject();
                };
            });
        });
    });
};

userSchema.statics.authorise = function (body) {
    var User = this;
    return User.findOneAndUpdate(
        {
            code: body.code
        },
        {
            $push: {
                authorised: {
                    full_name: body.full_name
                }
            }
        }
    );
};


userSchema.pre('save', function (next) {
    var user = this;
    if (user.isModified('password')) {
        bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(user.password, salt, (err, hash) => {
                user.password = hash;
                next();
            });
        });
    } else {
        next();
    }
});

var User = mongoose.model('user', userSchema);

module.exports = { User };