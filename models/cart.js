const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
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
        timestamp: Date
    }, { collection: 'carts' }
);

const Cart = mongoose.model("Cart", cartSchema);
module.exports = Cart;
