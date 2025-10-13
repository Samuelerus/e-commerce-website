const express = require('express');
const route = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const check_jwt_token = require('../middleware/user_auth');
const mailer = require('../utils/nodemailer');
const {create_payment} = require('../utils/paystack');
require('dotenv').config();

const User = require('../models/user');
const Order = require('../models/order');
const { find } = require('../models/counter');



// to perform a transaction with a saved card on paystack
route.post('/transaction/charge_authorization', check_jwt_token, async (req, res) => {
    const { user_id, email } = req.user;
    const { order_id, total } = req.body;
    if (!order_id || !total) {
        return res.status(400).send({ status: 'error', msg: "some parameters missing" })
    }

    try {
        const order = await Order.findById(order_id)

        if (!order) {
            return res.status(404).send({ msg: "Order not found" })
        }

        const order_items = order.items;
        const item_names = order_items.map(item => item.item_name).join(", ");
        
        const response = await create_payment(email, total)
        const reference = response.data.reference;
        await Order.findByIdAndUpdate(order_id, {payment_reference: reference})
        await mailer.payment_verify_mail(email, order_id, item_names, total)
        res.status(200).send({ status: 'ok', msg: `Transaction status: pending`, response })

    } catch (e) {
        console.error("Transaction failed ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});



//under review
// //to verify payments
// route.get('verify/:reference', async (req, res) => {
//     const { reference } = req.params;
//     try {
//         const response = await axios.get(
//             `https://api.paystack.co/transaction/verify/${reference}`,
//             {
//                 headers: {
//                     Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//                 },
//             }
//         );
//         const data = response.data.data;

//         if (data.status === "success") {
//             return res.status(200).send({ status: "ok", msg: "Transaction was successful", data })
//         }

//         return res.status(200).send(data);
//     } catch (e) {
//         console.error("Transaction failed ----->>>", e);
//         return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
//     }
// });


//paystack webhook for extra verification
route.post('/confirm_payment', express.raw({ type: 'application/json' }), async (req, res) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;

    // Extract raw body: prefer route-level raw buffer, then req.rawBody set by global verify,
    // then fallback to stringified JSON. We convert buffers to string.
    const raw = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : (typeof req.rawBody === 'string' ? req.rawBody : (req.body ? JSON.stringify(req.body) : ''));

    if (!raw) {
        console.warn('Paystack webhook: raw body is empty or missing; signature verification may fail.');
    }

    const hash = crypto.createHmac('sha512', secret).update(raw).digest('hex');

    const signature = req.headers['x-paystack-signature'];
    if (!signature) {
        console.warn('Paystack webhook: no x-paystack-signature header present.');
        return res.status(400).send({ status: 'error', msg: 'Missing signature header' });
    }

    console.log(hash, signature)
    if (hash === signature) {
        // Parse event from the verified raw body
        let event;
        try {
            event = JSON.parse(raw);
        } catch (err) {
            console.error('Failed to parse webhook JSON:', err);
            return res.status(400).send({ status: 'error', msg: 'Invalid JSON payload' });
        }

        
        const charge_status = event.event;
        console.log(`This is the status -----> ${charge_status}`);
        if (charge_status === "charge.success") {
            console.log("Order successful. DB will now update")
            // Update order status to "paid"
            const { reference, authorization } = event.data;
            const order = await Order.findOneAndUpdate(
                { payment_reference: reference }, { payment_status: "paid" }, { new: true }
            )
            const order_items = order.items;
            const item_names = order_items.map(item => item.item_name).join(", ");
            // Fetch order with populated user
            const orderWithUser = await Order.findOne({ payment_reference: reference }).populate('user_id');
            const user = orderWithUser ? orderWithUser.user_id : null;

            if (!user) {
                console.error('User not found for order reference', reference);
            } else {
                // check if authorization_code already exists, if not, add to saved_cards
                // This prevents duplicate cards
                const already_saved = Array.isArray(user.saved_cards) && user.saved_cards.some(
                    card => card.authorization_code === authorization.authorization_code
                );

                // If it's a new card, add card with authorization_code to user's saved_cards
                if (!already_saved) {
                    await User.findByIdAndUpdate(user._id,
                        {
                            $push: {
                                saved_cards: {
                                    authorization_code: authorization.authorization_code,
                                    card_type: authorization.card_type,
                                    last4: authorization.last4,
                                    exp_month: authorization.exp_month,
                                    exp_year: authorization.exp_year,
                                    bank: authorization.bank,
                                }
                            }
                        }, { new: true }
                    );
                }

                // Notify user by email
                await mailer.payment_success_mail(user.email, user.fullname, order._id, item_names, order.total_amount);
            }


            return res.status(200).send({ charge_status, order })
        }

        if (charge_status === "charge.failed") {
            // Update order status to "failed"
            const reference = event.data.reference;
            const order = await Order.findOneAndUpdate(
                { payment_reference: reference }, { payment_status: "failed" }, { new: true }
            )
            const order_items = order.items;
            const item_names = order_items.map(item => item.item_name).join(", ");
            //fetch user details
            const user = await User.findById(user_id);
            //Notify by email
            await mailer.payment_failure_mail(user.email, user.fullname, order._id, item_names, order.total_amount, event.data.gateway_response)
            return res.json({ charge_status, order })
        }
    }
});

module.exports = route;