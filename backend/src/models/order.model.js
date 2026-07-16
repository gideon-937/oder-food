import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({

    customer: {
        phone: { type: String, required: true }
    },

    items: [
        {
            name: { type: String, required: true },
            quantity: { type: Number, required: true },
            price: { type: Number, required: true }
        }
    ],

    totalPrice: Number,

    checkoutRequestId: { type: String },
    merchantRequestId: { type: String },
    mpesaReceiptNumber: { type: String },
    amountPaid: Number,
    phoneNumber: String,
    transactionDate: String,
    failureReason: String,

    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Failed"],
        default: "Pending"
    },

    orderStatus: {
        type: String,
        default: "Pending"
    }

}, { timestamps: true });

export default mongoose.model("Order", orderSchema);