const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/user');

const generate_profile_link = (user_id) => {
  const token = jwt.sign(
    { user_id },
    process.env.JWT_SECRET_KEY,
    { expiresIn: "24h" } // expires after 1 day
  );
  return `https://cart-ecommerce.com/profile/my_account?token=${token}`;
};

const generate_password_reset_token = async (email) => {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = crypto.createHash("sha256").update(token).digest("hex");

  await User.findOneAndUpdate({email}, {
    reset_password_token: hash,
    reset_password_expires: Date.now() + 1000 * 5 * 60 //in 5 minutes
  })

  return token
}

module.exports = { generate_profile_link, generate_password_reset_token };