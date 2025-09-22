const { error } = require('console');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const app = express();

//parse JSON data coming in as requests
app.use(express.json());

//import my routes
app.use('/auth');


//connect to mongodb using the url in the env variable
mongoose.connect(process.env.MONGO_URI_LOCAL)
    .catch(error => console.log(`DB connection error: ${error}`));

const con = mongoose.connection;
