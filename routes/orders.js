const express = require('express');
const route = express.Router();
const check_jwt_token = require('../middleware/user_auth');


const Item = require('../models/item');
const Order = require('../models/order');
const User = require('../models/user');
const { findById } = require('../models/counter');

//to finalize an order
route.post('/confirm', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    const { order_id } = req.body;
    if (!order_id) {
        return res.status(400).send({ status: 'error', msg: "No order id" })
    }

    try {
        //find the order
        const order = await Order.findById(order_id);
        if (!order) {
            return res.status(404).send({ status: "error", msg: "No order found" })
        }
        //ensure the order belongs to the user
        if (order.user_id.toString() !== user_id) {
            return res.status(403).send({ status: "error", msg: "Order does not belong to user" })
        }
        //confirm the order has been paid for
        if (order.payment_status !== "paid") {
            return res.status(403).send({ status: "error", msg: "Order not paid for" })
        }

        //increase the number of times bought of each item by 1 and the units bought by quantity
        const items = await Order.findById(order_id).populate('items.item_id').lean();
        for (const order_item of items) {
            const item = await Item.findById(order_item._id)
            if (item) {
                item.times_bought += 1
                item.units_bought += order_item.quantity;
                await item.save();
            }
        }
        return res.status(200).send({ status: "ok", msg: "Order confirmed", order: order })

    } catch (e) {
        console.error("Could not complete order ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to view my orders
route.get('/my_orders', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    try {
        //find the user's orders
        const pending_orders = await Order.find({ user_id: user_id, delivery_status: "pending" }).sort({ timestamp: -1 }).lean();
        const delivered_orders = await Order.find({ user_id: user_id, delivery_status: "delivered" }).sort({ timestamp: -1 }).lean();
        //delete cancelled orders older than 365 days (1 year) from the database
        const one_year_ago = new Date();
        one_year_ago.setFullYear(one_year_ago.getFullYear() - 1);
        await Order.deleteMany({ user_id: user_id, delivery_status: "cancelled", timestamp: { $lt: one_year_ago } });
        const cancelled_orders = await Order.find({ user_id: user_id, delivery_status: "cancelled" }).sort({ timestamp: -1 }).lean();
        return res.status(200).send({
            status: "ok", msg: "Success",
            orders: {
                pending: pending_orders,
                delivered: delivered_orders,
                cancelled: cancelled_orders
            }
        });
    } catch (e) {
        console.error("Could not fetch orders ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to view a specific order
route.get('/:order_id', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    const { order_id } = req.params;
    if (!order_id) {
        return res.status(400).send({ status: 'error', msg: "No order id" })
    }
    try {
        //find the order
        const order = await Order.findById(order_id).select('-__v, -user_id, -_id').lean();
        if (!order) {
            return res.status(404).send({ status: "error", msg: "No order found" })
        }
        //ensure the order belongs to the user
        if (order.user_id.toString() !== user_id) {
            return res.status(403).send({ status: "error", msg: "Order does not belong to user" })
        }
        return res.status(200).send({ status: "ok", msg: "Success", order: order })
    } catch (e) {
        console.error("Could not fetch order ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});

//to cancel an order
//NOTE: only pending orders can be cancelled, no refunds after payment
route.post('/cancel', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    const { order_id } = req.body;
    if (!order_id) {
        return res.status(400).send({ status: 'error', msg: "No order id" })
    }
    try {
        //find the order
        const order = await Order.findById(order_id);
        if (!order) {
            return res.status(404).send({ status: "error", msg: "No order found" })
        }
        //ensure the order belongs to the user
        if (order.user_id.toString() !== user_id) {
            return res.status(403).send({ status: "error", msg: "Order does not belong to user" })
        }
        //ensure the order is still pending, otherwise deny cancellation
        if (order.delivery_status !== "pending" || order.payment_status === "paid") {
            return res.status(403).send({ status: "error", msg: "Only pending orders can be cancelled" })
        }
    } catch (e) {
        console.error("Error canceling order ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to rate and review delivered items
route.post('/rate&review', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    const { item_id, rating, review } = req.body;
    if (!item_id || !rating || rating < 1 || rating > 5) {
        return res.status(400).send({ status: 'error', msg: "Bad request" })
    }
    try {
        //ensure the user has actually bought and received the item
        const order = await Order.findOne({ user_id: user_id, delivery_status: "delivered", "items.item_id": item_id }).lean();
        if (!order) {
            return res.status(403).send({ status: "error", msg: "You can only rate/review items you have bought and received" })
        }
        //find the item
        const item = await Item.findById(item_id);
        if (!item) {
            return res.status(404).send({ status: "error", msg: "Item not found" })
        }
        //update the item's rating and reviews
        item.rate_count += rating;
        item.rate_number += 1;
        item.rating = (item.rate_count / item.rate_number).toFixed(1);
        if (review) {
            item.reviews.push({ user_id: user_id, rating: rating, review: review, timestamp: Date.now() });
        }
        await item.save();
        return res.status(200).send({ status: "ok", msg: "Item rated/reviewed successfully", item: { item_name: item.item_name, rating: item.rating, reviews: item.reviews } })
    } catch (e) {
        console.error("Error rating/reviewing item ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to confirm you have recieved an order
route.post('/:order_id/confirm', check_jwt_token, async (req, res) => {
    const { order_id } = req.params;
    const { recieved } = req.query;
    if (!order_id || !recieved) {
        res.sendStatus(400)({ status: "error", msg: "Bad request" })
    }
    if (recieved === "no") {
        res.sendStatus(200)({ msg: "support will be contacted and get back to you with a form" })
    }

    try {
        //find the order and update it to delivered
        const order = findById(order_id).lean();

        if (order.delivery_status !== "shipped") {
            return res.status(403).send({ msg: "Order already delivered, cancelled or still pending" })
        }

        const delivered_order = await Order.findByIdAndUpdate(order_id,
            { delivery_status: "delivered" }, { new: true }
        ).select('_id, items, total_amount, delivery_status').lean();

        return res.status(200).send({ status: "Success", msg: "Order delivered. Thanks for shopping", delivered_order })
    } catch (e) {
        console.error("Some error occurred ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


module.exports = route;