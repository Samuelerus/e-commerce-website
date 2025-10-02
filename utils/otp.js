const CryptoJS = require('crypto-js');
const { randomInt } = require('crypto');

const generate_OTP = () => {
    const otp = String(randomInt(100000, 1000000));
    return otp
};

const encrypt = (info, passkey) => {
    const encrypted = CryptoJS.AES.encrypt(info, passkey).toString();
    return encrypted
};

const decrypt = (encrypted, passkey) => {
    const bytes = CryptoJS.AES.decrypt(encrypted, passkey);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted
};

module.exports = { generate_OTP, encrypt, decrypt };