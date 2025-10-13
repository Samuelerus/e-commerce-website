const crypto = require('crypto');

const verify_paystack_signature = (req, res, next) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const signature = req.headers["x-paystack-signature"];

    if (!signature) {
        return res.status(400).send("Missing signature header");
    }

    const hash = crypto
        .createHmac("sha512", secret)
        .update(req.rawBody) // must be set by express.json verify
        .digest("hex");

    if (hash !== signature) {
        console.log("❌ Signature mismatch");
        return res.status(401).send("Invalid signature");
    }

    console.log("✅ Signature verified");
    next();
};

module.exports = verify_paystack_signature