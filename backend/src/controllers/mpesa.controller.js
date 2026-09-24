
import mongoose from "mongoose";
import Order from "../models/order.model.js";
import { stkPush } from "../services/mpesa.js";

/**
 * Normalize Kenyan phone numbers for comparison
 */
const normalizePhone = (phone) => {
    if (!phone) return null;

    const value = String(phone).replace(/\s+/g, "");

    if (value.startsWith("+254")) {
        return value.substring(1);
    }

    if (value.startsWith("07") || value.startsWith("01")) {
        return `254${value.substring(1)}`;
    }

    return value;
};


/**
 * Initiate M-Pesa STK Push
 */
export const initiatePayment = async (req, res) => {
    try {

        const { orderId, phone } = req.body;

        // --------------------------------------
        // Validate input
        // --------------------------------------

        if (
            !orderId ||
            typeof orderId !== "string" ||
            !mongoose.isValidObjectId(orderId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        if (
            !phone ||
            typeof phone !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid phone number is required"
            });
        }

        const normalizedPhone = normalizePhone(phone);

        if (!/^254(7|1)\d{8}$/.test(normalizedPhone)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Kenyan phone number"
            });
        }


        // --------------------------------------
        // Find order
        // --------------------------------------

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }


        // --------------------------------------
        // Prevent paying an already paid order
        // --------------------------------------

        if (order.paymentStatus === "Paid") {
            return res.status(400).json({
                success: false,
                message: "This order has already been paid"
            });
        }


        // --------------------------------------
        // Prevent multiple active STK requests
        // --------------------------------------

        if (
            order.checkoutRequestId &&
            order.paymentStatus === "Pending"
        ) {
            return res.status(400).json({
                success: false,
                message: "Payment is already being processed"
            });
        }


        // --------------------------------------
        // Verify order phone
        // --------------------------------------

        const orderPhone = normalizePhone(order.customer?.phone);

        if (
            orderPhone &&
            orderPhone !== normalizedPhone
        ) {
            return res.status(400).json({
                success: false,
                message: "Phone number does not match the order"
            });
        }


        // --------------------------------------
        // Validate order total
        // --------------------------------------

        const totalAmount = Number(order.totalPrice);

        if (
            !Number.isFinite(totalAmount) ||
            totalAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid order amount"
            });
        }


        // --------------------------------------
        // Send STK Push
        // --------------------------------------

        const response = await stkPush(
            normalizedPhone,
            totalAmount,
            order._id.toString()
        );


        // --------------------------------------
        // Validate M-Pesa response
        // --------------------------------------

        if (
            !response ||
            !response.CheckoutRequestID ||
            !response.MerchantRequestID
        ) {
            console.error(
                "Invalid STK response:",
                response
            );

            return res.status(502).json({
                success: false,
                message: "Unable to initiate M-Pesa payment"
            });
        }


        // --------------------------------------
        // Save payment request
        // --------------------------------------

        order.checkoutRequestId =
            response.CheckoutRequestID;

        order.merchantRequestId =
            response.MerchantRequestID;

        order.paymentStatus = "Pending";

        await order.save();


        console.log(
            "M-Pesa STK initiated for order:",
            order._id.toString()
        );


        // --------------------------------------
        // Return only what frontend needs
        // --------------------------------------

        return res.status(200).json({
            success: true,
            message: "STK Push sent successfully",
            checkoutRequestId:
                response.CheckoutRequestID
        });

    } catch (error) {

        console.error(
            "STK Push Controller Error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to initiate payment"
        });
    }
};


/**
 * M-Pesa Callback
 */
export const mpesaCallback = async (req, res) => {

    try {

        console.log(
            "===== M-PESA CALLBACK RECEIVED ====="
        );


        // --------------------------------------
        // Validate callback structure
        // --------------------------------------

        const callback =
            req.body?.Body?.stkCallback;

        if (!callback) {

            console.error(
                "Invalid M-Pesa callback structure"
            );

            return res.json({
                ResultCode: 1,
                ResultDesc: "Invalid callback"
            });
        }


        const {
            CheckoutRequestID,
            ResultCode,
            ResultDesc,
            CallbackMetadata
        } = callback;


        if (!CheckoutRequestID) {

            console.error(
                "Missing CheckoutRequestID"
            );

            return res.json({
                ResultCode: 1,
                ResultDesc: "Missing CheckoutRequestID"
            });
        }


        // --------------------------------------
        // Find the order
        // --------------------------------------

        const order = await Order.findOne({
            checkoutRequestId: CheckoutRequestID
        });


        if (!order) {

            console.error(
                "No order found for CheckoutRequestID:",
                CheckoutRequestID
            );

            // Acknowledge callback so it is not
            // repeatedly retried.
            return res.json({
                ResultCode: 0,
                ResultDesc: "Accepted"
            });
        }


        // --------------------------------------
        // Ignore duplicate callback
        // --------------------------------------

        if (order.paymentStatus === "Paid") {

            console.log(
                "Duplicate payment callback ignored:",
                order._id.toString()
            );

            return res.json({
                ResultCode: 0,
                ResultDesc: "Accepted"
            });
        }


        // --------------------------------------
        // Payment failed
        // --------------------------------------

        if (Number(ResultCode) !== 0) {

            order.paymentStatus = "Failed";

            order.failureReason =
                ResultDesc || "M-Pesa payment failed";

            await order.save();

            console.log(
                "Payment failed:",
                ResultDesc
            );

            return res.json({
                ResultCode: 0,
                ResultDesc: "Accepted"
            });
        }


        // --------------------------------------
        // Extract callback metadata
        // --------------------------------------

        const items =
            CallbackMetadata?.Item || [];

        const getValue = (name) => {

            const item = items.find(
                (entry) =>
                    entry?.Name === name
            );

            return item?.Value ?? null;
        };


        const mpesaReceiptNumber =
            getValue("MpesaReceiptNumber");

        const amountPaid =
            Number(getValue("Amount"));

        const phoneNumber =
            getValue("PhoneNumber");

        const transactionDate =
            getValue("TransactionDate");


        // --------------------------------------
        // Validate payment amount
        // --------------------------------------

        const expectedAmount =
            Number(order.totalPrice);


        if (
            !Number.isFinite(amountPaid) ||
            amountPaid !== expectedAmount
        ) {

            console.error(
                "M-Pesa amount mismatch:",
                {
                    orderId: order._id.toString(),
                    expectedAmount,
                    amountPaid
                }
            );

            order.paymentStatus = "Failed";

            order.failureReason =
                "Payment amount does not match order total";

            await order.save();

            return res.json({
                ResultCode: 0,
                ResultDesc: "Accepted"
            });
        }


        // --------------------------------------
        // Validate receipt number
        // --------------------------------------

        if (
            !mpesaReceiptNumber ||
            typeof mpesaReceiptNumber !== "string"
        ) {

            console.error(
                "Missing M-Pesa receipt number"
            );

            return res.json({
                ResultCode: 1,
                ResultDesc: "Missing payment receipt"
            });
        }


        // --------------------------------------
        // Validate payment phone
        // --------------------------------------

        const expectedPhone =
            normalizePhone(order.customer?.phone);

        const paidPhone =
            normalizePhone(phoneNumber);


        if (
            expectedPhone &&
            paidPhone &&
            expectedPhone !== paidPhone
        ) {

            console.error(
                "M-Pesa phone mismatch:",
                {
                    orderId:
                        order._id.toString(),
                    expectedPhone,
                    paidPhone
                }
            );

            order.paymentStatus = "Failed";

            order.failureReason =
                "Payment phone does not match order phone";

            await order.save();

            return res.json({
                ResultCode: 0,
                ResultDesc: "Accepted"
            });
        }


        // --------------------------------------
        // Mark order as paid
        // --------------------------------------

        order.paymentStatus = "Paid";

        order.orderStatus = "Processing";

        order.mpesaReceiptNumber =
            mpesaReceiptNumber;

        order.amountPaid =
            amountPaid;

        order.phoneNumber =
            phoneNumber;

        order.transactionDate =
            transactionDate;


        await order.save();


        console.log(
            "Payment successful. Order updated:",
            order._id.toString()
        );


        // --------------------------------------
        // Acknowledge Safaricom
        // --------------------------------------

        return res.json({
            ResultCode: 0,
            ResultDesc: "Accepted"
        });


    } catch (error) {

        console.error(
            "M-Pesa Callback Error:",
            error.message
        );

        return res.json({
            ResultCode: 1,
            ResultDesc: "Failed"
        });
    }
};

