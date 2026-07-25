import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/database.js";

const PORT = process.env.PORT || 5000;

connectDB();

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
import mongoose from "mongoose";

mongoose.connection.once("open", () => {
    console.log("Connected database:", mongoose.connection.name);
    console.log("Host:", mongoose.connection.host);
});