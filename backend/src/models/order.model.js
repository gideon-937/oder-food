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

    // Prevent concurrent requests from initiating duplicate STK Pushes.
    // Keep the claim if the outcome is uncertain until reconciliation.
    paymentInitiationClaimed: {
        type: Boolean,
        default: false
    },

    mpesaReceiptNumber: {
        type: String
    },

    amountPaid: Number,

    phoneNumber: String,

    transactionDate: String,

    failureReason: String,

    // Flag orders whose payment outcome requires investigation.
    reconciliationRequired: {
        type: Boolean,
        default: false
    },

    // Stock is reserved when the order is created.
    // Release it only after a confirmed payment failure.
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