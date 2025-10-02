const express = require('express');
const route = express.Router();
const check_jwt_token = require('../middleware/user_auth');
const calculate_delivery_fee = require('../functions/delivery_fee');
const cloudinary = require('../utils/cloudinary');
const uploader = require('../utils/multer');
require('dotenv').config();


const User = require('../models/user');
const Item = require('../models/item');
const Cart = require('../models/cart');
const Order = require('../models/order');
const Review = require('../models/review');

//homepage
route.get('/', async (req, res) => {
    try {
        const date = new Date(Date.now() + 3 * 60 * 60 * 1000)
        const categories = await Item.distinct("category");
        const top_selling = await Item.find({})
            .sort({ unit_bought: -1 })
            .limit(10)
            .lean();
        const flash_sale = await Item.find({ discount_expires: { $lte: date } })
            .limit(10)
            .lean();
        const more = await Item.find({})
            .limit(15)
            .lean();
        return res.status(200).send({ status: "ok", msg: "Success", categories, top_selling, flash_sale, more })

    } catch (e) {
        console.error("Some error occurred ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});

//to shop by category
route.get('/search_by_categories', async (req, res) => {
    const { category, page, limit } = req.query;
    try {
        //find all items that belong to that category
        const items = await Item.find({ category: category })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        let count = books.length;
        let msg = "Success"
        if (count === 0) {
            msg = "Nothing in this category"
        }
        return res.status(200).send({ msg, items })
    } catch (e) {
        console.error("Some error occurred ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to search items by name
route.get('/search_by_name', async (req, res) => {
    const { name, page, limit } = req.query;
    try {
        //create a regex to search with
        const regex = new RegExp("^" + name, "i");
        //search for the items and sort by most popular
        const items = await Item.find({ item_name: regex })
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ units_bought: -1 })
            .lean();
        let count = items.length;
        let msg = "Success";
        if (count === 0) {
            msg = "No result found"
        }
        return res.status(200).send({ msg, items })
    } catch (e) {
        console.error("Couldn't get items ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to view top selling products
route.get('/popular', async (req, res) => {
    const { page, limit } = req.query;
    try {
        //find items and sort them by most popular
        const items = await Item.find({})
            .sort({ units_bought: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        let count = items.length;
        let msg = "Success";
        if (count === 0) {
            msg = "No products"
            return res.status(404).send({ msg })
        }
        return res.status(200).send({ msg, items })
    } catch (e) {
        console.error("Error, couldn't get items ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to view products on flash sale
route.get('/flash_sale', async (req, res) => {
    const { page, limit } = req.query;
    try {
        //find items and sort out the ones that have a close discount expiry (3hours)
        const date = new Date(Date.now() + 3 * 60 * 60 * 1000)
        const items = await Item.find({ discount_expires: { $lte: date } })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();
        let count = items.length;
        let msg = "Success";
        if (count === 0) {
            msg = "Nothing on flash sale"
            return res.status(404).send({ msg })
        }
        return res.status(200).send({ msg, items })
    } catch (e) {
        console.error("Error, couldn't get items ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to preview a product before ordering
route.get('/preview', async (req, res) => {
    const { name } = req.query;
    try {
        //find the product
        const item = await Item.findOne({ item_name: name }).lean();
        //throw error if not found
        if (!item) {
            return res.status(404).send({ status: "error", msg: "Item not found" })
        }
        //show the product's rating
        const rating = item.rating;
        //show the number of times product has been bought
        const units_bought = item.units_bought;
        //show the product's most liked reviews
        const reviews = await Review.find({ item_id: item._id })
            .select('username rating review likes timestamp')
            .sort({ likes: -1 })
            .limit(5)
            .lean();
        //add some products on the page
        const top_selling = await Item.find({})
            .sort({ units_bought: -1 })
            .limit(10)
            .lean();
        const more = await Item.find({})
            .limit(15)
            .lean();
        return res.status(200).send({
            status: 'ok', msg: "Success",
            item, rating, units_bought, reviews, top_selling, more
        })
    } catch (e) {
        console.error("Some error occurred ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to add to cart
route.post('/add_to_cart/:custom_id', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    const { custom_id } = req.params;
    const { quantity, color, size } = req.body;

    if (!custom_id) {
        return res.status(400).send({ status: 'error', msg: "No id" });
    }

    if (!quantity) {
        return res.status(400).send({ status: 'error', msg: "Enter all required fields" });
    }
    try {
        //find the item by its id
        const item = await Item.findOne({ custom_id: custom_id }).lean();
        if (!item) {
            return res.status(404).send({ status: "error", msg: "Item not found" })
        }
        //push item to user's cart in the cart collection
        await Cart.updateOne({ user: user_id },
            {
                $push: {
                    items: {
                        item_id: item._id,
                        item_name: item.item_name,
                        quantity: quantity || 1,
                        color: color || undefined,
                        size: size || undefined
                    }
                }
            }
        );
        return res.status(200).send({ status: "ok", msg: `${item.item_name} added to user's cart` })
    } catch (e) {
        console.error("Could not add to cart  ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});

//to view cart
route.get('/view_cart', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    try {
        //find the user cart by their id and check the items in their cart
        const cart = await Cart.findOne({ user: user_id }).populate('items.item_name', '-__v -timestamp').lean();
        if (!cart) {
            return res.status(404).send({ status: "error", msg: "Cart not found" })
        }
        //check if they have anything in their cart
        if (cart.items.length === 0) {
            return res.status(404).send({ status: "error", msg: "Cart is empty" })
        }
        const items = cart.items
        //add some products to show on the page
        const top_selling = await Item.find({})
            .sort({ unit_bought: -1 })
            .limit(10)
            .lean();
        const more = await Item.find({})
            .limit(15)
            .lean();
        return res.status(200).send({ status: 'ok', msg: "Success", items, top_selling, more })
    } catch (e) {
        console.error("Some error occurred ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});

//to save a product
route.post('/save/:custom_id', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    const { custom_id } = req.params;
    try {
        //find the item by its id
        const item = await Item.findOne({ custom_id: custom_id }).lean();
        if (!item) {
            return res.status(404).send({ status: "error", msg: "Item not found" })
        }
        //push item to user's saved items
        await User.updateOne({ user: user_id },
            {
                $push: {
                    saved: {
                        item_id: item._id
                    }
                }
            }
        );
        return res.status(200).send({ status: "ok", msg: "Item saved" })
    } catch (e) {
        console.error("Error saving ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to view saved items
route.get('/view_saved', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    try {
        //find the user cart by their id and check the items in their cart
        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).send({ status: "error", msg: "No user found" })
        }
        //check if they have anything in their saved items
        if (user.saved_items.length === 0) {
            return res.status(404).send({ status: "error", msg: "No saved products" })
        }
        const items = user.saved_items;
        return res.status(200).send({ status: 'ok', msg: "Success", items })
    } catch (e) {
        console.error("Some error occurred ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to checkout a product
route.post('/checkout', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    const { items } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).send({ status: 'error', msg: "Enter items to checkout" });
    }
    try {
        let total_amount = 0;
        //get the necessary details from the items array to create an order
        const order_items = items.map(async (item) => {
            const product = await Item.findOne({ custom_id: item.custom_id }).lean();
            const price = product.discount_price || product.price;
            const subtotal = price * item.quantity;
            total_amount += subtotal;
            return {
                item_id: product._id,
                item_name: product.item_name,
                quantity: item.quantity,
                color: item.color || undefined,
                size: item.size || undefined
            }
        });

        //create a new pending order
        const order = new Order();
        order.user_id = user_id;
        order.items = order_items;
        order.delivery_address = {};
        order.delivery_fee = 0;
        order.total_amount = total_amount;
        order.payment_status = "pending";
        order.delivery_status = "pending";
        order.payment_reference = "";
        order.timestamp = Date.now();
        await order.save();

        //find the user's saved cards
        const user = await User.findById(user_id).select('saved_cards').lean();
        if (!user) {
            return res.status(404).send({ status: "error", msg: "No user found" })
        }
        if (!user.saved_cards || user.saved_cards.length === 0) {
            return res.status(404).send({ status: "error", msg: "No saved cards found, add one or initialize a new transaction" })
        }

        //mask the user's cards and send
        const masked = user.saved_cards.map(card => ({
            card_id: card._id, // safe selector for charging
            display: `${(card.card_type || "CARD").toUpperCase()} •••• ${card.last4} (${card.bank || "Unknown"}, exp ${card.exp_month}/${card.exp_year})`,
            card_type: card.card_type,
            last4: card.last4,
            exp_month: card.exp_month,
            exp_year: card.exp_year,
            bank: card.bank
        }));

        //find the user's addresses
        if (!user.addresses || user.addresses.length === 0) {
            return res.status(404).send({ status: "error", msg: "No saved addresses found, add a new one" })
        }
        const addresses = await User.findById(user_id).select('addresses').lean();

        return res.status(201).send({
            status: "ok", msg: "Order created successfully, pending",
            order: order.id,
            saved_cards: masked,
            addresses
        })
    } catch (e) {
        console.error("Order creation failed ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});



//to select address and calculate the total order amount
route.post('/amount', check_jwt_token, async (req, res) => {
    const { user_id } = req.user;
    const { order_id, address_id } = req.body;

    try {
        const order = await Order.findById(order_id);
        //ensure the order belongs to the user
        if (order.user_id.toString() !== user_id) {
            return res.status(403).send({ status: "error", msg: "Order does not belong to user" })
        }

        // Find the user and the particular address from their addresses
        const address = await User.findOne(
            { "addresses._id": address_id }, //find the address
            { "addresses.$": 1 } // $ projection returns only the matching element
        );

        //calulate the delivery fee from the order address and the amount
        const state = address.state || "";
        const amount = order.total_amount;
        const delivery_fee = calculate_delivery_fee(state, amount);
        const new_total = amount + delivery_fee;

        //push the delivery address and new total to the order
        order.delivery_address = address;
        order.delivery_fee = delivery_fee;
        order.total_amount = new_total;
        await order.save();

        return res.status(200).send({
            status: "ok", msg: "Success",
            order_id,
            address,
            subtotal: amount,
            delivery_fee,
            total: new_total,
            currency: "USD"
        })

    } catch (e) {
        console.error("Some error occured ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});

module.exports = route;