

import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Food from "../models/food.model.js";

// ======================================
// RELEASE STOCK RESERVATION
// Called when M-Pesa confirms payment failure
// ======================================

export const releaseStockReservation = async (orderId, reason) => {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        throw new Error("Invalid order ID for stock restoration.");
    }

    const session = await mongoose.startSession();

    try {
        let released = false;

        await session.withTransaction(async () => {
            // Only one callback can release a reservation.
            // Changing stockReserved to false prevents duplicate restoration.
            const order = await Order.findOneAndUpdate(
                {
                    _id: orderId,
                    paymentStatus: "Pending",
                    stockReserved: true
                },
                {
                    $set: {
                        paymentStatus: "Failed",
                        stockReserved: false,
                        failureReason:
                            reason || "M-Pesa payment failed."
                    }
                },
                {
                    new: true,
                    session
                }
            );

            // Already released, already paid, or not eligible.
            if (!order) {
                return;
            }

            // Restore the quantities reserved for this order.
            for (const item of order.items) {
                if (!item.foodId) {
                    throw new Error(
                        `Cannot restore stock: foodId is missing in order ${order._id}.`
                    );
                }

                const quantity = Number(item.quantity);

                if (!Number.isInteger(quantity) || quantity < 1) {
                    throw new Error(
                        `Invalid reserved quantity in order ${order._id}.`
                    );
                }

                const result = await Food.updateOne(
                    { _id: item.foodId },
                    { $inc: { stock: quantity } },
                    { session }
                );

                if (result.matchedCount !== 1) {
                    throw new Error(
                        `Cannot restore stock: food ${item.foodId} was not found.`
                    );
                }
            }

            released = true;
        });

        return released;

    } finally {
        await session.endSession();
    }
};