const calculate_delivery_fee = (amount, state) => {
    // set to 0 if amount exceeds 20,000
    if (amount >= 20000) {
        return 0;
    }
    // set delivery fee based on state
    if (String(state).toLowerCase() === "lagos state") {return 10};
    if (String(state).toLowerCase() === "fct") {return 20};
    if (String(state).toLowerCase() === "kano state") {return 30};
    return 50; // default fee for other states
}


module.exports = calculate_delivery_fee;