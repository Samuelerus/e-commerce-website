const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const Order = require('../models/order')

const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
    },
});


const welcome_mail = async (email, fullname, profile_link) => {
    //get html file path and read it
    let template_path = path.join(__dirname, '..', 'templates', "welcome_email.html");
    let template = fs.readFileSync(template_path, 'utf-8');
    //replace placeholders
    template = template.replace("fullname", fullname || "")
        .replace("https://example.com/user-profile", profile_link)

    try {
        const info = await transport.sendMail({
            from: `"Cart" <${process.env.MAIL_USER || "no-reply@gmail.com"}>`,
            to: email,
            subject: "Welcome Email",
            html: template,
        });
        console.log("email sent successfully")
        return info;
    } catch (e) {
        console.error("Email sending failed ----->>>", e);
        throw new Error("email sending failed")
    }
};

const forgot_password_mail = async (email, reset_link) => {
    let template_path = path.join(__dirname, '..', 'templates', "forgot_password_email.html");
    let template = fs.readFileSync(template_path, 'utf-8');
    //replace placeholders
    template = template.replace("https://example.com/reset-password?token=123456", reset_link)
    try {
        const info = await transport
            .sendMail({
                from: `"Cart" <${process.env.MAIL_USER || "no-reply@gmail.com"}>`,
                to: email,
                subject: `Password Reset Request`,
                html: template,
            });
        console.log("email sent successfully")
        return info;
    } catch (e) {
        console.error("Email sending failed ----->>>", e);
        throw new Error("email sending failed")
    }
};

const send_otp_email = async (email, otp, expires_in, support_mail) => {
    let template_path = path.join(__dirname, '..', 'templates', "otp_email.html");
    let template = fs.readFileSync(template_path, 'utf-8');
    //replace placeholders
    template = template.replace("email", email)
        .replace("{otp}", otp)
        .replace("{expires_in}", expires_in)
        .replace("{support_mail}", support_mail)
    try {
        const info = await transport
            .sendMail({
                from: `"Cart" <${process.env.MAIL_USER || "no-reply@gmail.com"}>`,
                to: email,
                subject: `Your OTP code`,
                html: template,
            });
        console.log("email sent successfully")
        return info;
    } catch (e) {
        console.error("Email sending failed ----->>>", e);
        throw new Error("email sending failed")
    }
};

const payment_verify_mail = async (email, order_id, order_items, amount) => {
    let template_path = path.join(__dirname, '..', 'templates', "payment_verification.html");
    let template = fs.readFileSync(template_path, 'utf-8');
    //replace placeholders
    template = template.replace("{{order_id}}", order_id)
        .replace("{{order_items}}", order_items)
        .replace("{{amount}}", amount)
    try {
        const info = await transport
            .sendMail({
                from: `"Cart" <${process.env.MAIL_USER || "no-reply@gmail.com"}>`,
                to: email,
                subject: "Transaction Notification",
                html: template,
            });
        console.log("email sent successfully")
        return info;
    } catch (e) {
        console.error("Email sending failed ----->>>", e);
        throw new Error("email sending failed")
    }
};

const payment_success_mail = async (email, fullname, order_id, order_items, amount) => {
    let template_path = path.join(__dirname, '..', 'templates', "payment_success.html");
    let template = fs.readFileSync(template_path, 'utf-8');
    //replace placeholders
    template = template.replace("{{customer_name}}", fullname)
        .replace("{{order_id}}", order_id)
        .replace("{{order_items}}", order_items)
        .replace("{{amount}}", amount)
    try {
        const info = await transport
            .sendMail({
                from: `"Cart" <${process.env.MAIL_USER || "no-reply@gmail.com"}>`,
                to: email,
                subject: "Payment Confirmation",
                html: template,
            });
        console.log("email sent successfully")
        return info;
    } catch (e) {
        console.error("Email sending failed ----->>>", e);
        throw new Error("email sending failed")
    }
};


const payment_failure_mail = async (email, fullname, order_id, order_items, amount, reason) => {
    let template_path = path.join(__dirname, '..', 'templates', "payment_failed.html");
    let template = fs.readFileSync(template_path, 'utf-8');
    //replace placeholders
    template = template.replace("{{customer_name}}", fullname)
        .replace("{{order_id}}", order_id)
        .replace("{{order_items}}", order_items)
        .replace("{{amount}}", amount)
        .replace("{{failure_reason}}", reason)
    try {
        const info = await transport
            .sendMail({
                from: `"Cart" <${process.env.MAIL_USER || "no-reply@gmail.com"}>`,
                to: email,
                subject: "Payment Failure",
                html: template,
            });
        console.log("email sent successfully")
        return info;
    } catch (e) {
        console.error("Email sending failed ----->>>", e);
        throw new Error("email sending failed")
    }
};

const order_shipped_mail = async (email, fullname, order_id) => {
    let template_path = path.join(__dirname, '..', 'templates', "order_shipped.html");
    let template = fs.readFileSync(template_path, 'utf-8');

    const order = await Order.findById(order_id)
    let items_html = "";
    order.items.forEach(item => {
        items_html += `
    <div class="item">
      <img src="${item.item_image_url}" alt="${item.item_name}">
      <div class="item-details">
        <h4>${item.item_name}</h4>
        <p>Quantity: ${item.quantity}</p>
      </div>
    </div>
  `;
    });

    //replace placeholders
    template = template.replace("{{order_items}}", items_html)
        .replace("{{user_name}}", fullname)
        .replace("{{order_id}}", order_id)
        .replace("{{order_total}}", order.total_amount);


    try {
        const info = await transport
            .sendMail({
                from: `"Cart" <${process.env.MAIL_USER || "no-reply@gmail.com"}>`,
                to: email,
                subject: "Order Shipped!",
                html: template,
            });
        console.log("email sent successfully")
        return info;
    } catch (e) {
        console.error("Email sending failed ----->>>", e);
        throw new Error("email sending failed")
    }
};



const order_delivered_mail = async (email, fullname, order_id) => {
    let template_path = path.join(__dirname, '..', 'templates', "order_delivered.html");
    let template = fs.readFileSync(template_path, 'utf-8');

    const order = await Order.findById(order_id)
    const address_obj = order.delivery_address;

    // Exclude _id and __v
    const exclude = ["_id", "__v"];

    const address = Object.entries(address_obj)
        .filter(([key]) => !exclude.includes(key)) // drop unwanted keys
        .map(([_, value]) => value)
        .join(" ");

    let items_html = "";
    order.items.forEach(item => {
        items_html += `
    <div class="item">
      <img src="${item.item_image_url}" alt="${item.item_name}">
      <div class="item-details">
        <h4>${item.item_name}</h4>
        <p>Quantity: ${item.quantity}</p>
      </div>
    </div>
  `;
    });

    //replace placeholders
    template = template.replace("{{order_items}}", items_html)
        .replace("{{user_name}}", fullname)
        .replace("{{order_id}}", order_id)
        .replace("{{order_total}}", order.total_amount)
        .replace("{{order_address}}", address)


    try {
        const info = await transport
            .sendMail({
                from: `"Cart" <${process.env.MAIL_USER || "no-reply@gmail.com"}>`,
                to: email,
                subject: "Order Delivered!",
                html: template,
            });
        console.log("email sent successfully")
        return info;
    } catch (e) {
        console.error("Email sending failed ----->>>", e);
        throw new Error("email sending failed")
    }
};





const mailer = {
    welcome_mail,
    forgot_password_mail,
    send_otp_email,
    payment_verify_mail,
    payment_success_mail,
    payment_failure_mail,
    order_shipped_mail,
    order_delivered_mail
}
module.exports = mailer;