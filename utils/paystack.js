const dotenv = require('dotenv');
const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);

dotenv.config();

//function to create an order payment
const create_payment = async (email, amount) => {
    console.log(` -------->> Payment initiated for ${email} for amount ${amount}`);
    try {
        const payment_data = {
            email,
            amount: amount * 100,
            currency: "NGN",
            ref: Date.now().toString()
        };

        const response = await paystack.transaction.initialize(payment_data);
        return response
    } catch (e) {
        console.error(error);
        return {msg: "some error occured", error}
    }
};

module.exports = {create_payment};