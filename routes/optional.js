//The endpoints below are still subject to further review.
//They may be implemented in the future or removed entirely.

//to initiate a new transaction with a new card on paystack
route.post('/transaction/initialize', check_jwt_token, async (req, res) => {
    const { user_id, email } = req.user;
    const { amount } = req.body;
    if (!amount || !email) {
        return res.status(400).send({ status: 'error', msg: "Enter all required fields" });
    }
    try {
        const response = await axios.post(
            'https://api.paystack.co/transaction/initialize',
            { email, amount: amount * 100 },
            {
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
                }
            }
        );

        const { reference, authorization_url } = response.data.data;

        //create new pending order in DB and save reference
        const order = new Order();
        order.user_id = user_id;
        order.items = [];
        order.total_amount = amount;
        order.payment_status = "pending";
        order.delivery_status = "pending";
        order.payment_reference = reference;
        order.timestamp = Date.now();
        await order.save();


        res.status(200).send({
            status: "ok", msg: "Success",
            authorization_url,
            reference,
        });
    } catch (e) {
        console.error("Transaction failed ----->>>", e);
        return res.status(500).send({ status: "error", msg: "some error occurred", error: e.msg })
    }
});
