const express = require('express');
const route = express.Router();
const bcrypt = require('bcryptjs');
const check_jwt_token = require('../middleware/user_auth');
const cloudinary = require('../utils/cloudinary');
const uploader = require('../utils/multer');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();
const User = require('../models/user');

//to view your account
route.get('/my_account', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    try {
        //find the user's profile by the id
        const profile = await User.findById(user_id, { password: 0, is_online: 0, is_verified: 0, timestamp: 0, __v: 0 }).lean();
        let msg = "Success";
        if (!profile) {
            msg = "Not found"
            return res.status(404).send({ msg })
        }
        return res.status(200).send({ msg, profile });
    } catch (e) {
        console.error("Some error occurred ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to edit your profile
route.put('/edit_profile', check_jwt_token, uploader.single("image"), async (req, res) => {
    const { user_id } = req.user;
    const { fullname, phone_no } = req.body;

    try {
        //add/replace profile picture if sent
        if (req.file) {
            //find the public id and url for the old profile picture if there is one
            let p_user = User.findById(user_id);

            if (p_user) {
                let img_id = p_user.profile_img_id
                //upload replacement profile pic to cloudinary
                const result = await cloudinary.uploader.upload(req.file.path, {
                    folder: "cart_user_profile_pics",
                    public_id: img_id,
                    overwrite: true,
                });
                let img_url = result.secure_url;
                //update img_url
                await User.findByIdAndUpdate(user_id, { profile_img_url: img_url })
            }
            else {
                let img_url = "";
                let img_id = "";
                //upload image to cloudinary
                const result = await cloudinary.uploader.upload(req.file.path, {
                    folder: "_user_profile_pics"
                });
                img_url = result.secure_url;
                img_id = result.public_id;
                console.log(result);
                await User.findByIdAndUpdate(user_id, { profile_img_url: img_url, profile_img_id: img_id });
            }
        }
        //find the user to get current details
        let existing_user = await User.findById(user_id).lean();

        //find the user by their id and update their info
        let user = await User.findByIdAndUpdate(user_id, {
            fullname: fullname || existing_user.fullname,
            phone_no: phone_no || existing_user.phone_no

        }, { new: true, password: 0, __v: 0 }).lean();
        return res.status(200).send({ status: 'ok', msg: "User profile updated successfully", user })
    } catch (e) {
        console.error("Some error occurred ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to view your saved items
route.get('/saved_items', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    try {
        //find the user's saved items and display them
        const user = await User.findById(user_id).lean();
        if (user.saved.length === 0) {
            return res.status(404).send({ status: "error", msg: "Nothing in saved" })
        }
        const saved = user.saved;
        return res.status(200).send({ status: 'ok', msg: "Success", saved })
    } catch (e) {
        console.error("Some error occurred ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//addresses
//to view your address book
route.get('/address_book/view', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    try {
        const user = await User.findById(user_id).lean();
        const addresses = user.addresses;
        if (addresses.length === 0) {
            return res.status(404).send({ status: "error", msg: "No addresses saved. Please add" })
        }
        return res.status(200).send({ status: 'ok', msg: "Success", addresses });
    } catch (e) {
        console.error("Could not add to cart  ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});

//to add an address to your address book
route.post('/address_book/add', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    const { fullname, phone_no, address, city, state } = req.body;
    //check if the required fields were entered
    if (!address || !city || !state) {
        return res.status(400).send({ status: 'error', msg: "Enter all required fields" });
    }
    try {
        const user = await User.findById(user_id).lean();
        await User.updateOne({ _id: user_id },
            {
                $push: {
                    addresses: {
                        fullname: fullname || user.fullname,
                        phone_no: phone_no || user.phone_no,
                        address: address,
                        city: city,
                        state: String,
                        default: false
                    }
                }
            }
        );
        return res.status(200).send({ status: "ok", msg: "Address added successfully" })
    } catch (e) {
        console.error("Could not add address  ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});

//to edit an address and/or set as default
route.put('/address_book/edit/:adress_id', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    const { adress_id } = req.params;
    const { fullname, phone_no, address, city, state, default_address } = req.body;
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(204).send({ status: 'ok', msg: "Nothing edited" });
    }
    try {
        //find the user
        const user = await User.findById(user_id).lean();
        //update the information provided
        await User.updateOne({ _id: user_id, "addresses._id": adress_id },
            {
                $set: {
                    "addresses.$.fullname": fullname || user.fullname,
                    "addresses.$.phone_no": phone_no || user.phone_no,
                    "addresses.$.address": address || user.address,
                    "addresses.$.city": city || user.city,
                    "addresses.$.state": state || user.state,
                    "addresses.$.default": default_address || false
                }
            }
        );
        return res.status(200).send({ status: "ok", msg: "Address edited successfully" })
    } catch (e) {
        console.error("Could not edit address  ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to delete an address
route.put('/address_book/delete/:_id', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    const { _id } = req.params;
    //check if a valid id was sent
    if (!_id || !mongoose.Types.ObjectId.isValid(_id)) {
        return res.status(400).send({ 'status': 'error', msg: 'No ID or invalid format' })
    }
    try {
        //find the user and delete the address
        await User.updateOne(
            { _id: user_id },
            {
                $pull: {
                    addresses: { _id: _id }
                }
            }
        );
        return res.status(200).send({ status: 'ok', msg: "Adress deleted" });
    } catch (e) {
        console.error("Could not delete address ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg });
    };
});



//to add a new card
route.post('/cards/add_card', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    const user = await User.findById(user_id).lean();
    if (!user) {
        return res.status(404).send({ status: "error", msg: "No user found" })
    }
    try {
        const response = await axios.post(
            "https://api.paystack.co/transaction/initialize",
            {
                email: user.email,
                amount: 0,
                channels: ["card"],
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        return res.status(200).send({
            status: "ok",
            authorization_url: response.data.data.authorization_url,
            reference: response.data.data.reference,
        });
    } catch (e) {
        console.error("Could not add card  ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to change your password
route.put('/change_password', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    const { oldpass, newpass, confirm } = req.body;

    //check if all fields are entered
    if (!oldpass || !newpass || !confirm)
        return res.status(400).send({ 'status': 'error', msg: 'All details must be inputed' });

    //check for the user
    const user = await User.findById(user_id).lean();
    if (!user) { return res.status(404).send({ 'status': 'error', msg: "Not found" }) };

    //check if the old password matches
    if (await bcrypt.compare(oldpass, user.password) !== true) {
        return res.status(400).send({ 'status': 'error', msg: "Incorrect Password" })
    }

    //check if the new passwords entered match
    if (newpass !== confirm)
        return res.status(400).send({ 'status': 'error', msg: 'Passwords must match' });

    try {
        //to change password
        const en_pass = await bcrypt.hash(newpass, 10);
        await User.updateOne({ _id: user_id }, { password: en_pass }, { password: 0 });

        return res.status(200).send({ status: 'ok', msg: 'Password successfully reset' })
    } catch (e) {
        console.error("Some error occurred ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }

});

//to delete your account
route.delete('/delete_account', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    try {
        //check for the user's account
        const account = await User.findById(user_id).lean();
        if (!account) {
            return res.status(404).send({ 'status': 'error', msg: 'User not found' });
        }
        //to delete the account
        await User.findByIdAndDelete(user_id);
        return res.status(200).send({ status: 'ok', msg: "Successfully deleted" });
    } catch (e) {
        console.error("error deleting account ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    };
});


module.exports = route;