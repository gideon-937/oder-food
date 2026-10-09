
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({

    customer: {
        name: {
            type: String,
            required: true,
            trim: true
        },

        phone: {
            type: String,
            required: true,
            trim: true
        }
    },

    items: [
        {
            // Links the order item to the actual food in the database
            foodId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Food",
                required: true
            },

            name: {
                type: String,
                required: true
            },

            quantity: {
                type: Number,
                required: true,
                min: 1,
                validate: {
                    validator: Number.isSafeInteger,
                    message: "Quantity must be a whole number."
                }
            },

            price: {
                type: Number,
                required: true,
                min: 0
            }
        }
    ],

    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },

    checkoutRequestId: {
        type: String
    },

    merchantRequestId: {
        type: String
    },

    mpesaReceiptNumber: {
        type: String
    },

    amountPaid: Number,

    phoneNumber: String,

    transactionDate: String,

    failureReason: String,

    // True when stock has been reserved for a pending payment.
    // Successful payments consume the reserved stock.
    // Failed payments should release it exactly once.
    stockReserved: {
        type: Boolean,
        default: false
    },

    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Failed"],
        default: "Pending"
    },

    orderStatus: {
        type: String,
        default: "Pending"
    }

}, {
    timestamps: true
});

export default mongoose.model("Order", orderSchema);

