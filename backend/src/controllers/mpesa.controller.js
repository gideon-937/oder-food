
import mongoose from "mongoose";
import Order from "../models/order.model.js";
import { stkPush } from "../services/mpesa.js";
import { releaseStockReservation } from "../utils/stockReservation.js";

/**
 * Normalize Kenyan phone numbers.
 * Examples:
 * 0712345678 -> 254712345678
 * 0112345678 -> 254112345678
 * +254712345678 -> 254712345678
 */
const normalizePhone = (phone) => {
    if (phone === undefined || phone === null) {
        return null;
    }

    const value = String(phone).replace(/[\s-]/g, "");

    if (value.startsWith("+254")) {
        return value.substring(1);
    }

    if (value.startsWith("07") || value.startsWith("01")) {
        return `254${value.substring(1)}`;
    }

    return value;
};

/**
 * Send an M-Pesa callback acknowledgement.
 */
const acknowledgeCallback = (res) => {
    return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Accepted"
    });
};

/**
 * Initiate M-Pesa STK Push.
 */
export const initiatePayment = async (req, res) => {
    try {
        const { orderId, phone } = req.body;

        // Validate order ID.
        if (
            !orderId ||
            typeof orderId !== "string" ||
            !mongoose.isValidObjectId(orderId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        // Validate phone number.
        if (!phone || typeof phone !== "string") {
            return res.status(400).json({
                success: false,
                message: "A valid Kenyan phone number is required."
            });
        }

        const normalizedPhone = normalizePhone(phone);

        if (
            !normalizedPhone ||
            !/^254[17]\d{8}$/.test(normalizedPhone)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid Kenyan phone number."
            });
        }

        // Find the order.
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        // Do not initiate payment for an already-paid order.
        if (order.paymentStatus === "Paid") {
            return res.status(400).json({
                success: false,
                message: "This order has already been paid."
            });
        }

        // Failed orders must be recreated with fresh stock.
        if (order.paymentStatus === "Failed") {
            return res.status(400).json({
                success: false,
                message: "This order failed. Please create a new order."
            });
        }

        // The order must have reserved stock.
        if (order.stockReserved !== true) {
            return res.status(409).json({
                success: false,
                message:
                    "Stock is not reserved for this order. Please create a new order."
            });
        }

        // Prevent duplicate STK requests for the same order.
        if (order.checkoutRequestId) {
            return res.status(409).json({
                success: false,
                message: "Payment is already being processed."
            });
        }

        // Check the order phone.
        const orderPhone = normalizePhone(order.customer?.phone);

        if (
            !orderPhone ||
            orderPhone !== normalizedPhone
        ) {
            return res.status(400).json({
                success: false,
                message: "Phone number does not match the order."
            });
        }

        // Validate the amount.
        const totalAmount = Number(order.totalPrice);

        if (
            !Number.isFinite(totalAmount) ||
            totalAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid order amount."
            });
        }

        /*
         * Do not automatically release stock if stkPush throws.
         * The request may have reached Safaricom even if the
         * application did not receive its response.
         */

        const response = await stkPush(
            normalizedPhone,
            totalAmount,
            order._id.toString()
        );

        if (
            !response ||
            !response.CheckoutRequestID ||
            !response.MerchantRequestID
        ) {
            console.error("Invalid STK response:", response);

            return res.status(502).json({
                success: false,
                message:
                    "The payment request result is uncertain. Check the order before retrying."
            });
        }

        /*
         * Save the identifiers before returning success so
         * the callback can locate the order.
         */
        order.checkoutRequestId = response.CheckoutRequestID;
        order.merchantRequestId = response.MerchantRequestID;
        order.paymentStatus = "Pending";

        await order.save();

        console.log(
            "M-Pesa STK initiated for order:",
            order._id.toString()
        );

        return res.status(200).json({
            success: true,
            message: "STK Push sent successfully.",
            checkoutRequestId: response.CheckoutRequestID
        });
    } catch (error) {
        console.error("STK Push Controller Error:", error);

        return res.status(500).json({
            success: false,
            message:
                "The payment request result may be uncertain. Check payment status before retrying."
        });
    }
};

/**
 * M-Pesa STK Push callback.
 */
export const mpesaCallback = async (req, res) => {
    try {
        console.log("===== M-PESA CALLBACK RECEIVED =====");

        const callback = req.body?.Body?.stkCallback;

        if (!callback) {
            console.error("Invalid M-Pesa callback structure");

            return res.status(400).json({
                ResultCode: 1,
                ResultDesc: "Invalid callback structure"
            });
        }

        const {
            CheckoutRequestID,
            ResultCode,
            ResultDesc,
            CallbackMetadata
        } = callback;

        if (!CheckoutRequestID) {
            console.error("Missing CheckoutRequestID");

            return res.status(400).json({
                ResultCode: 1,
                ResultDesc: "Missing CheckoutRequestID"
            });
        }

        const order = await Order.findOne({
            checkoutRequestId: CheckoutRequestID
        });

        if (!order) {
            console.error(
                "No order found for CheckoutRequestID:",
                CheckoutRequestID
            );

            /*
             * Acknowledge unknown callbacks to avoid endless
             * retries. Investigate them using server logs.
             */
            return acknowledgeCallback(res);
        }

        /*
         * Idempotency: a duplicate success callback must not
         * change stock or process the order a second time.
         */
        if (order.paymentStatus === "Paid") {
            console.log(
                "Duplicate payment callback ignored:",
                order._id.toString()
            );

            return acknowledgeCallback(res);
        }

        /*
         * Ignore duplicate callbacks for an order already
         * marked Failed. A late success requires reconciliation.
         */
        if (order.paymentStatus === "Failed") {
            console.error(
                "Callback received for failed order; reconciliation may be required:",
                order._id.toString(),
                ResultCode
            );

            return acknowledgeCallback(res);
        }

        // Confirmed M-Pesa failure: release stock exactly once.
        if (Number(ResultCode) !== 0) {
            const reason =
                ResultDesc || "M-Pesa payment failed.";

            await releaseStockReservation(order._id, reason);

            console.log(
                "Payment failure processed:",
                order._id.toString(),
                reason
            );

            return acknowledgeCallback(res);
        }

        /*
         * ResultCode 0 means M-Pesa reports success.
         * Extract payment metadata before changing order status.
         */
        const items = CallbackMetadata?.Item || [];

        const getValue = (name) => {
            const item = items.find(
                entry => entry?.Name === name
            );

            return item?.Value ?? null;
        };

        const mpesaReceiptNumber = getValue("MpesaReceiptNumber");
        const rawAmount = getValue("Amount");
        const phoneNumber = getValue("PhoneNumber");
        const transactionDate = getValue("TransactionDate");

        const amountPaid = Number(rawAmount);
        const expectedAmount = Number(order.totalPrice);

        /*
         * A successful M-Pesa payment with invalid metadata
         * must not be treated as an ordinary payment failure.
         * Keep stock reserved and flag the order for review.
         */
        if (
            !mpesaReceiptNumber ||
            typeof mpesaReceiptNumber !== "string" ||
            !Number.isFinite(amountPaid) ||
            !Number.isFinite(expectedAmount)
        ) {
            order.failureReason =
                "Successful callback has incomplete payment metadata. Manual reconciliation required.";

            await order.save();

            console.error(
                "Incomplete successful payment metadata:",
                order._id.toString()
            );

            return acknowledgeCallback(res);
        }

        // Validate amount.
        if (amountPaid !== expectedAmount) {
            order.failureReason =
                "Payment amount mismatch. Manual reconciliation required.";

            order.amountPaid = amountPaid;
            order.mpesaReceiptNumber = mpesaReceiptNumber;
            order.phoneNumber = phoneNumber ?? undefined;
            order.transactionDate = transactionDate ?? undefined;

            await order.save();

            console.error("M-Pesa amount mismatch:", {
                orderId: order._id.toString(),
                expectedAmount,
                amountPaid
            });

            // Do not release stock: money may have been received.
            return acknowledgeCallback(res);
        }

        // Validate payment phone.
        const expectedPhone = normalizePhone(order.customer?.phone);
        const paidPhone = normalizePhone(phoneNumber);

        if (
            !expectedPhone ||
            !paidPhone ||
            expectedPhone !== paidPhone
        ) {
            order.failureReason =
                "Payment phone mismatch. Manual reconciliation required.";

            order.amountPaid = amountPaid;
            order.mpesaReceiptNumber = mpesaReceiptNumber;
            order.phoneNumber = phoneNumber ?? undefined;
            order.transactionDate = transactionDate ?? undefined;

            await order.save();

            console.error("M-Pesa phone mismatch:", {
                orderId: order._id.toString(),
                expectedPhone,
                paidPhone
            });

            // Do not release stock for a reported successful payment.
            return acknowledgeCallback(res);
        }

        // Verify stock is still reserved.
        if (order.stockReserved !== true) {
            order.failureReason =
                "M-Pesa reports successful payment, but stock is not reserved. Manual reconciliation required.";

            order.amountPaid = amountPaid;
            order.mpesaReceiptNumber = mpesaReceiptNumber;
            order.phoneNumber = phoneNumber;
            order.transactionDate = transactionDate ?? undefined;

            await order.save();

            console.error(
                "Paid transaction requires reconciliation; stock is not reserved:",
                order._id.toString()
            );

            return acknowledgeCallback(res);
        }

        /*
         * Mark payment successful.
         * Stock is not deducted here because createOrder
         * already reserved it.
         */
        order.paymentStatus = "Paid";
        order.orderStatus = "Processing";
        order.mpesaReceiptNumber = mpesaReceiptNumber;
        order.amountPaid = amountPaid;
        order.phoneNumber = phoneNumber;
        order.transactionDate = transactionDate ?? undefined;
        order.failureReason = undefined;

        await order.save();

        console.log(
            "Payment successful. Order updated:",
            order._id.toString()
        );

        return acknowledgeCallback(res);
    } catch (error) {
        console.error("M-Pesa Callback Error:", error);

        /*
         * Acknowledge with an error so the callback can be
         * investigated and, depending on Safaricom's retry
         * behaviour, retried. Never release stock in this catch.
         */
        return res.status(500).json({
            ResultCode: 1,
            ResultDesc: "Callback processing failed"
        });
    }
};