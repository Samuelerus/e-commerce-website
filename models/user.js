const mongoose = require('mongoose');
const Counter = require('./counter');

const userSchema = new mongoose.Schema(
  {
    custom_id: { type: String, unique: true },
    fullname: String,
    phone_no: String,
    email: String,
    password: String,
    role: { type: String, enum: ["member", "admin"], default: "member" },
    is_online: { type: Boolean, default: false },
    is_verified: { type: Boolean, default: false },
    saved_cards: [
      {
        authorization_code: String,
        card_type: String,
        last4: String,
        exp_month: String,
        exp_year: String,
        bank: String,
      }
    ],
    saved_items: [
      {
        item_id: { type: mongoose.Schema.Types.ObjectId, ref: "Item" }
      }
    ],
    addresses: [
      {
        fullname: String,
        phone_no: String,
        address: String,
        city: String,
        state: String,
        default: { type: Boolean, required: true }
      }
    ],
    profile_img_url: { type: String, default: undefined },
    profile_img_id: { type: String, default: undefined },
    reset_password_token: {type: String, default: undefined},
    reset_password_expires: {type: Date, default: undefined},
    otp: {
      code: String,
      expires_at: Date
    },
    timestamp: Date
  },
  { collection: 'users' }
)

// Auto-generate customId before saving
userSchema.pre('save', async function (next) {
  if (this.isNew) {
    const counter = await Counter.findOneAndUpdate(
      { name: 'user' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.custom_id = `user_${counter.seq.toString().padStart(3, '0')}`;
  }
  next();
});


const model = mongoose.model('User', userSchema);
module.exports = model;