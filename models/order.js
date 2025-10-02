const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        items: [
            {
                item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
                item_name: { type: String, required: true },
                quantity: { type: Number, default: 1, required: true },
                color: String,
                size: Number,
                item_image_url: String
            }
        ],
        delivery_address: {
            fullname: String,
            phone_no: String,
            address: String,
            city: String,
            state: String,
        },
        delivery_fee: { type: Number, default: 0 },
        total_amount: Number,
        payment_status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
        delivery_status: { type: String, enum: ["pending", "shipped", "delivered", "cancelled"], default: "pending" },
        payment_reference: String,
        timestamp: { type: Date, default: Date.now}
    }, { collection: 'orders' }
);

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;