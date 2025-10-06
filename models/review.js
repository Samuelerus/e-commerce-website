const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item", required: true },
        username: String,
        rating: { type: Number, min: 1, max: 5, required: true },
        review: String,
        likes: Number,
        timestamp: { type: Date, default: Date.now }
    },
    { collection: 'reviews' }
);

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;