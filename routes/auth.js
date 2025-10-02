const express = require('express');
const route = express.Router();
const bcrypt = require('bcryptjs');
const check_jwt_token = require('../middleware/user_auth');
const { generate_OTP, encrypt, decrypt } = require('../utils/otp');
const { generate_profile_link, generate_password_reset_token } = require('../utils/special_use_tokens');
const mailer = require('../utils/nodemailer');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const mongoose = require('mongoose');


const User = require('../models/user');
const Cart = require('../models/cart');

//endpoints

//for signing up
route.post('/signup', async (req, res) => {
    const { fullname, phone_no, email, password, role, admin_key } = req.body;

    //check for the required fields
    if (!fullname || !phone_no || !email || !password) {
        return res.status(400).send({ 'status': 'error', msg: 'All details must be inputed' })
    };

    //check if phone_no is exactly 11 digits
    if (!/^\d{11}$/.test(phone_no)) {
        return res.status(400).send({ status: 'error', msg: "Phone number must be 11 digits" });
    };

    //check if the email matches the correct format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).send({ status: 'error', msg: 'Invalid email format' });
    };

    if (password.length < 8) {
        return res.status(400).send({ status: 'error', msg: "Password must be at least 8 characters long" });
    };

    //check for admin key in case of admin signup
    if (role === "admin" && admin_key !== process.env.ADMIN_SECRET_KEY) {
        return res.status(401).send({ status: 'error', msg: "You are not authorized to sign up as admin" });
    }

    try {
        //check if a user with this email already exists
        let match = await User.find({ email: email }).lean();
        if (match) {
            return res.status(400).send({ status: 'error', msg: 'User with this email already exists' });
        }

        //create a user object
        const user = new User();
        user.fullname = fullname;
        user.phone_no = phone_no;
        user.email = email;
        user.password = await bcrypt.hash(password, 10);
        user.role = role || "member";
        user.is_online = false;
        user.is_verified = false;
        user.saved_cards = [];
        user.saved_items = [];
        user.items_bought = [];
        user.addresses = [];
        user.otp = {};
        user.timestamp = Date.now();

        //save user document
        await user.save();

        //create cart for the user
        const cart = new Cart();
        cart.user_id = user._id;
        cart.items = [];
        cart.timestamp = Date.now();
        await cart.save();

        //generate OTP
        const otp = generate_OTP();
        const encrypted = encrypt(otp, process.env.OTP_PASSKEY);
        //store OTP with expiry (5 minutes)
        await User.findOneAndUpdate({ email: email },
            {
                otp: {
                    code: encrypted,
                    expires_at: new Date(Date.now() + 5 * 60 * 1000)
                }
            });

        await mailer.send_otp_email(email, otp, "5", process.env.MAIL_USER);
        console.log("otp generated and email sent successfully")
        return res.status(201).send({ status: 'created', msg: "OTP generated and sent. Will expire in 5 minutes" });
    } catch (e) {
        console.error("Account creation failed ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});

//to regenerate the OTP if the first attempt was unsuccessful and send it again
route.post('/otp', async (req, res) => {
    const { email } = req.body;

    try {
        const otp = generate_OTP();
        const encrypted = encrypt(otp, process.env.OTP_PASSKEY);
        //store OTP with expiry (5 minutes)
        let user = await User.findOneAndUpdate({ email: email },
            {
                otp: {
                    code: encrypted,
                    expires_at: new Date(Date.now() + 5 * 60 * 1000)
                }
            });

        //check if the user has a previous unused otp and delete it
        if (user.otp) {
            await User.findOneAndUpdate({ email: email },
                {
                    $unset: { otp: "" }
                }
            )
        }
        await mailer.send_otp_email(email, otp, "5", process.env.MAIL_USER);
        console.log("otp generated and email sent successfully")
        return res.status(201).send({ status: 'created', msg: "OTP generated and sent. Will expire in 5 minutes" });
    } catch (e) {
        console.error("OTP generation failed or email not sent ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});

//to verify OTP and activate account
route.post('/activate', async (req, res) => {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email }).lean();

    try {
        if (!user || !user.otp) {
            return res.status(400).send({ status: 'error', msg: "Invalid email" });
        }

        const encrypted = user.otp.code;
        const decrypted = decrypt(encrypted, process.env.OTP_PASSKEY);

        if (otp !== decrypted) {
            return res.status(400).send({ status: 'error', msg: "Invalid OTP" });
        }

        if (user.otp.expires_at < Date.now()) {
            await User.updateOne({ email: email },
                {
                    $unset: { otp: "" }
                }
            )
            return res.status(400).send({ status: 'error', msg: "OTP expired" });
        }
        await User.findOneAndUpdate({ email: email },
            {
                is_verified: true,
                is_online: true,
                $unset: { otp: "" }
            }
        );
        const profile_link = generate_profile_link(user._id)
        await mailer.welcome_mail(email, user.fullname, profile_link);

        const token = jwt.sign(
            { user_id: user._id, email: email, role: user.role, is_verified: true },
            process.env.JWT_SECRET_KEY,
            { expiresIn: '1d' }
        );
        return res.status(200).send({ status: 'ok', msg: 'Account activated', token });
    } catch (e) {
        console.error("OTP verification failed ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to endpoint to login
route.put('/login', async (req, res) => {
    const { email, password } = req.body;

    //check for the required fields
    if (!email || !password) {
        return res.status(400).send({ 'status': 'error', msg: 'All details must be inputed' })
    }

    try {
        //check if a user with this email exists
        const user = await User.findOne({ email: email }).select('fullname password role suspended is_verified').lean();
        if (!user) {
            return res.status(404).send({ status: 'error', msg: 'no user with this email exists' });
        }

        //check if the password is correct
        if (await bcrypt.compare(password, user.password)) {
            // update user document
            await User.updateOne({ email: email }, { is_online: true }, { password: 0 }).lean();
            const token = jwt.sign(
                { user_id: user._id, email: email, role: user.role, is_verified: user.is_verified },
                process.env.JWT_SECRET_KEY,
                { expiresIn: '1d' }
            );
            return res.status(200).send({ status: 'ok', msg: 'Successful login', user, token });

        }

        return res.status(400).send({ status: 'error', msg: 'incorrect email or password' });

    } catch (e) {
        console.error("Error logging in ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//for forgot password
route.get('/forgot_password', async (req, res) => {
    const { email } = req.query;

    //check if email was sent
    if (!email) {
        return res.status(400).send({ 'status': 'error', msg: 'No email' });
    }

    const token = generate_password_reset_token(email);

    await mailer.forgot_password_mail(email, `https://cart-ecommerce.com/reset_password?token=${token}&email=${email}`);
    return res.status(200).send({ status: 'ok', msg: 'Password reset link sent to email if it exists' });
});

//to reset password
route.put('/reset_password', async (req, res) => {
    const { token, email } = req.query;
    const { newpass, confirm } = req.body;

    //check if an token and email were sent
    if (!token || !email) {
        return res.status(400).send({ 'status': 'error', msg: 'No token or email provided' })
    }

    //check if both passwords were sent
    if (!newpass || !confirm)
        return res.status(400).send({ 'status': 'error', msg: 'All details must be inputed' });

    //check if the new password is at least 8 characters
    if (newpass.length < 8)
        return res.status(400).send({ 'status': 'error', msg: 'Password must be at least 8 characters long' });

    //check if the passwords entered match
    if (newpass !== confirm)
        return res.status(400).send({ 'status': 'error', msg: 'Passwords must match' });

    try {
        const hash = crypto.createHash("sha256").update(token).digest("hex");
        //check if a user with that email exists
        const user = await User.findOne({
            email,
            reset_password_token: hash,
            reset_password_expires: { $gt: Date.now() }
        }).select('fullname').lean();
        if (!user) {
            return res.status(404).send({ status: 'error', msg: 'no such user found and/or invalid token' });
        }

        //to change password
        const en_pass = await bcrypt.hash(newpass, 10);
        await User.updateOne({ email }, {
            password: en_pass,
            reset_password_token: undefined,
            reset_password_expires: undefined
        });

        return res.status(200).send({ status: 'ok', msg: 'Password successfully reset', user })

    } catch (e) {
        console.error("Some error occurred ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});

//to logout
route.put('/logout', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    try {
        //check if a user with the id exists and log them out
        await User.updateOne({ _id: user_id }, { is_online: false });
        return res.status(200).send({ status: 'ok', msg: 'Successful logout' });
    } catch (e) {
        console.error("Some error occurred ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});

module.exports = route;