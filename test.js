const array = [
    {
        name: "rice",
        count: 2
    },
    {
        name: "beans",
        count: 14.6
    }
]


const obj = { _id: "123abc", name: "Samuel", age: 18, height: "201cm", __v: 0 };

// Exclude _id and __v
const exclude = ["_id", "__v"];

const str = Object.entries(obj) // gives [key, value] pairs
  .filter(([key]) => !exclude.includes(key)) // drop unwanted keys
  .map(([_, value]) => value)                // keep only values
  .join(", ");

console.log(str); 
// "Samuel, 18, 201cm"





// for (item of array) {
//     item.count += 3
// }
// console.log(array)


// let language = "JavaScript";

//     text = "";

//     (char of language) {

//     text += char;

// }
// let









// let x = (
//     5 + 2 * 3
// );

// //console.log(x)

// const date1 = Date.now();
// const date2 = new Date(Date.now() + 3 * 60 * 60 * 1000)

// if (date1 < date2) {
//     console.log("later")
// }
// else {console.log("earlier")}

// // 👈 this is what Paystack needs
// // ✅ Payment successful