const express = require('express');
const route = express.Router();
const jwt = require('jsonwebtoken');
const check_jwt_token = require('../middleware/user_auth');
const mailer = require('../utils/nodemailer');
const cloudinary = require('../utils/cloudinary');
const uploader = require('../utils/multer');
const discount = require('../functions/discount');

const Item = require('../models/item');
const Order = require('../models/order');
const User = require('../models/user');
const Review = require('../models/review');

//to add an item/product to the inventory
route.post('/add_item', check_jwt_token, uploader.single('image'), async (req, res) => {
    const { role } = req.user;
    const { item_name, quantity, price, description, category, colors, sizes, add_info } = req.body;

    //check if all the required fields were entered
    if (!item_name || !quantity || !price || !description || !category) {
        return res.status(400).send({ status: 'error', msg: 'Enter all required fields' })
    }

    if (role !== "admin") {
        return res.status(403).send({ 'status': 'error', msg: 'You are not authorized to perform this task' })
    }

    try {
        //check if an image was sent
        if (!req.file) {
            return res.status(400).send({ status: 'error', msg: 'Upload a picture' })
        }

        let img_url = "";
        let img_id = "";

        //upload image to cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: "product_images"
        });
        img_url = result.secure_url;
        img_id = result.public_id;
        console.log(result);

        //add an item
        const item = new Item();
        item.item_name = item_name;
        item.quantity = quantity;
        item.price = price;
        item.discount_price = null;
        item.discount_expires = null;
        item.description = description;
        item.category = category;
        item.times_bought = 0;
        item.units_bought = 0;
        item.rate_count = 0;
        item.rate_number = 0;
        item.rating = 0;
        item.colors = colors || [];
        item.sizes = sizes || [];
        item.add_info = add_info || null;
        item.item_image_url = img_url;
        item.item_image_id = img_id;
        item.timestamp = Date.now();

        //save the item
        await item.save();

        return res.status(201).send({ status: 'created', msg: 'Item added successfully', item });

    } catch (e) {
        console.error("Error adding item ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to edit a product's information
route.put('/edit/:custom_id', check_jwt_token, uploader.single("image"), async (req, res) => {
    const { role } = req.user;
    const { custom_id } = req.params;
    const { item_name, quantity, price, description, category, colors, sizes } = req.body;

    //check if an id was sent
    if (!custom_id) {
        return res.status(400).send({ 'status': 'error', msg: 'No ID' })
    }

    if (role !== "admin") {
        return res.status(403).send({ 'status': 'error', msg: 'You are not authorized to perform this task' })
    };

    try {
        //replace picture if sent
        if (req.file) {
            //find the public id and url for the old profile picture
            const product = await Item.findOne({ custom_id });
            if (!product) {
                return res.status(404).json({ message: "Product not found" });
            }

            let img_id = product.item_image_id;
            //upload replacement profile pic to cloudinary
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "product_images",
                public_id: img_id,
                overwrite: true,
                invalidate: true,
            });
            let img_url = result.secure_url;
            console.log(result)
            //update img_url
            await Item.findOneAndUpdate({ custom_id: custom_id }, { item_image_url: img_url });
        }

        //find the item 
        const existing_item = await Item.findOne({ custom_id: custom_id }).lean();

        //edit it's info
        const item = await Item.findOneAndUpdate({ custom_id: custom_id }, {
            item_name: item_name || existing_item.item_name,
            quantity: quantity || existing_item.quantity,
            price: price || existing_item.price,
            description: description || existing_item.description,
            category: category || existing_item.category,
            colors: colors || existing_item.colors,
            sizes: sizes || existing_item.sizes
        }, { new: true, __v: 0 }).lean();

        if (!existing_item) {
            return res.status(404).send({ 'status': 'error', msg: 'Item not found' })
        };

        return res.status(200).send({ status: 'ok', msg: "Item edited successfully", item })
    } catch (e) {
        console.error("Some error occurred ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});


//to set discounts on items
route.post('/set_discount', check_jwt_token, async (req, res) => {
    const { role } = req.user;
    const { item_name, percent, expires } = req.body;

    //check if all the required fields were entered
    if (!item_name || !percent || !expires) {
        return res.status(400).send({ status: 'error', msg: 'Enter all required fields' })
    }
    if (role !== "admin") {
        return res.status(403).send({ 'status': 'error', msg: 'You are not authorized to perform this task' })
    }
    try {
        const { discount_price, discount_expires } = await discount(item_name, percent, expires);
        //update the item with the discount price and expiry date
        const item = await Item.findOneAndUpdate({ item_name: item_name }, { discount_price: discount_price, discount_expires: discount_expires }, { new: true }).select('item_name, price, discount_price, discount_expires').lean();
        return res.status(200).send({ status: 'ok', msg: 'Discount set successfully', item });
    } catch (e) {
        console.error("Error setting discount ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }

});


//to mark an order as shipped
route.post('/mark_shipped', check_jwt_token, async (req, res) => {
    const { role } = req.user;
    const { order_id } = req.body;
    //check if an id was sent
    if (!order_id) {
        return res.status(400).send({ 'status': 'error', msg: 'No order ID' })
    }
    if (role !== "admin") {
        return res.status(403).send({ 'status': 'error', msg: 'You are not authorized to perform this task' })
    }
    try {
        //check if the order was preciously pending
        const order = await Order.findById(order_id).lean();

        if (!order) {
            return res.status(404).send({ status: "error", msg: "No order found" })
        }

        //check if the order is already shipped, delivered or cancelled
        if (order.delivery_status !== "pending") {
            return res.status(400).send({ 'status': 'error', msg: 'Order already shipped or cancelled' })
        }

        //find the owner of the order
        const user = await User.findById(order.user_id).lean();
        if (!user) {
            return res.status(404).send({ status: "error", msg: "No customer associated with this order" });
        }
        //mark the order as shipped
        const shipped_order = await Order.findByIdAndUpdate(order_id,
            { delivery_status: "shipped" }, { new: true }
        ).lean();

        //Notify the user by email
        await mailer.order_shipped_mail(user.email, user.fullname, order_id);

        return res.status(200).send({ status: "ok", msg: "Order marked as shipped", shipped_order })
    } catch (e) {
        console.error("Some error occured ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});

//to prompt confirmation from the buyer to mark an order as delivered
route.post('/mark_delivered', check_jwt_token, async (req, res) => {
    const { role } = req.user;
    const { order_id } = req.body;
    //check if an id was sent
    if (!order_id) {
        return res.status(400).send({ 'status': 'error', msg: 'No order ID' })
    }
    if (role !== "admin") {
        return res.status(403).send({ 'status': 'error', msg: 'You are not authorized to perform this task' })
    }

    //find the order and ensure it has been shipped and not cancelled
    const order = await Order.findById(order_id);

    if (!order) {
        return res.status(404).send({ status: "error", msg: "No order found" })
    }

    if (order.delivery_status !== "shipped") {
        return res.status(400).send({ 'status': 'error', msg: 'Order not shipped' })
    }

    //find the owner of the order
    const user = await User.findById(order.user_id).lean();
    if (!user) {
        return res.status(404).send({ status: "error", msg: "No customer associated with this order" });
    }

    //Notify the user by email and request confirmation
    await mailer.order_delivered_mail(user.email, user.fullname, order_id)

    return res.status(200).send({ status: "ok", msg: "Confirmation prompt sent to buyer", order })
});


module.exports = route;