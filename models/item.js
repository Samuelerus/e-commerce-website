const mongoose = require('mongoose'); // Import the mongoose library for MongoDB interaction
const Counter = require('./counter');

// Define the schema for the 'Item' collection
const itemSchema = new mongoose.Schema(
    {
        custom_id: { type: String, unique: true }, //unique custom id
        item_name: String, // Name of the item
        quantity: Number, // Total quantity available,
        price: Number, // Price of the item in USD
        discount_price: {type: Number, default: null}, //discount price if there is any
        discount_expires: {type: Date, default: null}, //date when the discount expires
        description: String, // Description of the item
        category: String, // Category of the item
        times_bought: {type: Number, default: 0}, // Number of times the item has been bought
        units_bought: {type: Number, default: 0}, // Number of units sold of the items
        rate_count: {type: Number, default: 0}, // Total rating score of the item
        rate_number: {type: Number, default: 0}, //Total number of times the item has been rated
        rating: {type: Number, min: 0, max: 5, default: 0}, // Average rating of the item
        colors: [String], // Colors of the item (if applicable)
        sizes: [Number], // Sizes of the item (if applicable)
        add_info: {type: String, default: null}, //additional info about the item
        item_image_url: String, // URL of the item's image
        item_image_id: String, // ID of the item's image in cloud storage
        timestamp: Date
    },
    { collection: 'items' }
);

// Auto-generate customId before saving
itemSchema.pre('save', async function (next) {
  if (this.isNew) {
    const counter = await Counter.findOneAndUpdate(
      { name: 'item' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.custom_id = `item_${counter.seq.toString().padStart(3, '0')}`;
  }
  next();
});

// Create an index on the 'item_name' field for faster querying
itemSchema.index({ item_name: 1 });

const Item = mongoose.model('Item', itemSchema)
module.exports = Item;