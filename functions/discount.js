const dotenv = require('dotenv');
dotenv.config();

const Item = require('../models/item');

const discount = async (item_name, percent, expires) => {
    const item = await Item.findOne({item_name: item_name}).lean();
    const discount = ((percent/100) * item.price);
    //set the discount price
    let discount_price = item.price - discount;
    //set expiry date in days
    let discount_expires = Date.now() + (expires * 24 * 60 * 60 * 1000);
    return {discount_price, discount_expires};
}

module.exports = discount;