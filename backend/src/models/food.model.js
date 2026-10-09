
import mongoose from "mongoose";

const foodSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        required: true
    },

    price: {
        type: Number,
        required: true,
        min: 0
    },

    image: {
        type: String
    },

    category: {
        type: String
    },

    // Whether customers can order this food
    available: {
        type: Boolean,
        default: true
    },

    // Number of units remaining in stock
    stock: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
        validate: {
            validator: Number.isSafeInteger,
            message: "Stock must be a whole number."
        }
    }

}, { timestamps: true });

export default mongoose.model("Food", foodSchema);

