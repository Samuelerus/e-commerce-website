const calculate_delivery_fee = (amount, state) => {
    // set to 0 if amount exceeds 1,000,000
    if (amount >= 1000000) {
        return 0;
    }
    // set delivery fee based on state
    if (state.toLowerCase() === "lagos") {return 1000};
    if (state.toLowerCase() === "abuja") {return 2000};
    if (state.toLowerCase() === "kano") {return 3000};
    return 5000; // default fee for other states
}

module.exports = calculate_delivery_fee;