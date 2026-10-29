import mongoose from "mongoose";
import Order from "../models/order.model.js";
import { stkPush } from "../services/mpesa.js";
import { releaseStockReservation } from "../utils/stockReservation.js";

/**
 * Normalize Kenyan phone numbers.
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
 * Acknowledge a callback already handled or safely recorded.
 */
const acknowledgeCallback = (res) => {
    return res.status(200).json({
        ResultCode: 0,
        ResultDesc: "Accepted"
    });
};

/**
 * Initiate an M-Pesa STK Push.
 *
 * Atomically claims an order before calling Safaricom.
 * Never automatically clear a claim after an uncertain result.
 */
export const initiatePayment = async (req, res) => {
    let claimedOrderId = null;

    try {
        const { orderId, phone } = req.body ?? {};

        if (
            typeof orderId !== "string" ||
            !mongoose.isValidObjectId(orderId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        if (typeof phone !== "string" || !phone.trim()) {
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

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        if (order.paymentStatus === "Paid") {
            return res.status(409).json({
                success: false,
                message: "This order has already been paid."
            });
        }

        if (order.paymentStatus === "Failed") {
            return res.status(409).json({
                success: false,
                message:
                    "This order has failed. Check its payment outcome before creating another order."
            });
        }

        if (order.stockReserved !== true) {
            return res.status(409).json({
                success: false,
                message: "Stock is not reserved for this order."
            });
        }

        if (
            order.checkoutRequestId ||
            order.paymentInitiationClaimed === true
        ) {
            return res.status(409).json({
                success: false,
                message:
                    "A payment request already exists or is being processed. Check its status before taking further action."
            });
        }

        const orderPhone = normalizePhone(order.customer?.phone);

        if (!orderPhone || orderPhone !== normalizedPhone) {
            return res.status(400).json({
                success: false,
                message: "Phone number does not match the order."
            });
        }

        const totalAmount = Number(order.totalPrice);

        if (
            !Number.isSafeInteger(totalAmount) ||
            totalAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid order amount."
            });
        }

        // Claim the order atomically before contacting Safaricom.
        const claimedOrder = await Order.findOneAndUpdate(
            {
                _id: order._id,
                paymentStatus: "Pending",
                stockReserved: true,
                paymentInitiationClaimed: { $ne: true },
                checkoutRequestId: { $in: [null, ""] }
            },
            {
                $set: {
                    paymentInitiationClaimed: true
                }
            },
            {
                returnDocument: "after"
            }
        );

        if (!claimedOrder) {
            return res.status(409).json({
                success: false,
                message:
                    "This order has already been claimed for payment. Check its status before taking further action."
            });
        }

        claimedOrderId = claimedOrder._id;

        /*
         * Safaricom may receive the request even if this call
         * times out. Never automatically release the claim.
         */
        const response = await stkPush(
            normalizedPhone,
            totalAmount,
            claimedOrder._id.toString()
        );

        if (
            !response ||
            typeof response.CheckoutRequestID !== "string" ||
            !response.CheckoutRequestID ||
            typeof response.MerchantRequestID !== "string" ||
            !response.MerchantRequestID
        ) {
            console.error(
                "Incomplete STK response; reconciliation required:",
                claimedOrder._id.toString()
            );

            return res.status(502).json({
                success: false,
                message:
                    "The payment outcome is uncertain. Do not retry or pay again until the transaction is checked."
            });
        }

        /*
         * Save Safaricom identifiers only if the order is
         * still eligible for this update.
         */
        const savedOrder = await Order.findOneAndUpdate(
            {
                _id: claimedOrder._id,
                paymentStatus: "Pending",
                stockReserved: true,
                paymentInitiationClaimed: true,
                checkoutRequestId: { $in: [null, ""] }
            },
            {
                $set: {
                    checkoutRequestId: response.CheckoutRequestID,
                    merchantRequestId: response.MerchantRequestID
                }
            },
            {
                returnDocument: "after"
            }
        );

        if (!savedOrder) {
            console.error(
                "STK response received but identifiers were not saved. Reconciliation required:",
                claimedOrder._id.toString(),
                response.CheckoutRequestID
            );

            return res.status(409).json({
                success: false,
                message:
                    "Safaricom may have received the payment request, but the order could not be updated. Do not retry; reconcile the transaction first."
            });
        }

        console.log(
            "M-Pesa STK initiated for order:",
            savedOrder._id.toString()
        );

        return res.status(200).json({
            success: true,
            message: "STK Push sent successfully.",
            checkoutRequestId: savedOrder.checkoutRequestId
        });
    } catch (error) {
        console.error("STK Push Controller Error:", {
            orderId: claimedOrderId?.toString() ?? null,
            message: error.message
        });

        return res.status(500).json({
            success: false,
            message:
                "The payment outcome may be uncertain. Do not retry until the transaction has been checked."
        });
    }
};

/**
 * Process an M-Pesa STK callback.
 *
 * A successful payment is recorded only after validating
 * the receipt, amount, and phone number.
 *
 * A late success for a failed order is recorded for
 * reconciliation, not automatically marked Paid.
 */
export const mpesaCallback = async (req, res) => {
    try {
        console.log("===== M-PESA CALLBACK RECEIVED =====");

        const callback = req.body?.Body?.stkCallback;

        if (!callback) {
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

        if (
            typeof CheckoutRequestID !== "string" ||
            !CheckoutRequestID
        ) {
            return res.status(400).json({
                ResultCode: 1,
                ResultDesc: "Missing CheckoutRequestID"
            });
        }

        const order = await Order.findOne({
            checkoutRequestId: CheckoutRequestID
        });

        if (!order) {
            /*
             * This can occur if the callback arrives before
             * the CheckoutRequestID is saved. Record the issue
             * for operational reconciliation.
             */
            console.error(
                "No order found for CheckoutRequestID:",
                CheckoutRequestID,
                "Reconciliation required."
            );

            return res.status(500).json({
                ResultCode: 1,
                ResultDesc: "Order not found for this callback"
            });
        }

        const items = Array.isArray(CallbackMetadata?.Item)
            ? CallbackMetadata.Item
            : [];

        const getValue = (name) => {
            const item = items.find(
                (entry) => entry?.Name === name
            );

            return item?.Value ?? null;
        };

        const mpesaReceiptNumber = getValue("MpesaReceiptNumber");
        const rawAmount = getValue("Amount");
        const phoneNumber = getValue("PhoneNumber");
        const transactionDate = getValue("TransactionDate");

        const amountPaid = Number(rawAmount);
        const expectedAmount = Number(order.totalPrice);

        const expectedPhone = normalizePhone(order.customer?.phone);
        const paidPhone = normalizePhone(phoneNumber);

        /*
         * A duplicate callback for an already-paid order must
         * not apply the payment transition a second time.
         */
        if (order.paymentStatus === "Paid") {
            console.log(
                "Duplicate callback ignored for paid order:",
                order._id.toString()
            );

            return acknowledgeCallback(res);
        }

        /*
         * Handle a possible late successful payment after the
         * order was marked Failed and stock was released.
         *
         * Do not change Failed to Paid automatically: stock may
         * already have been sold to another customer.
         */
        if (order.paymentStatus === "Failed") {
            if (Number(ResultCode) === 0) {
                const reconciliationReason =
                    "LATE M-PESA SUCCESS: payment reported successful after order failure. Verify the transaction and stock before resolving.";

                const evidence = {
                    failureReason: reconciliationReason,
                    reconciliationRequired: true,
                    ...(typeof mpesaReceiptNumber === "string"
                        ? { mpesaReceiptNumber }
                        : {}),
                    ...(rawAmount !== null &&
                    Number.isFinite(amountPaid)
                        ? { amountPaid }
                        : {}),
                    ...(phoneNumber !== null
                        ? { phoneNumber: String(phoneNumber) }
                        : {}),
                    ...(transactionDate !== null
                        ? { transactionDate: String(transactionDate) }
                        : {})
                };

                await Order.updateOne(
                    {
                        _id: order._id,
                        paymentStatus: "Failed"
                    },
                    {
                        $set: evidence
                    }
                );

                console.error(
                    reconciliationReason,
                    "Order:",
                    order._id.toString(),
                    "Receipt:",
                    mpesaReceiptNumber
                );
            } else {
                console.warn(
                    "Callback received for an already-failed order:",
                    order._id.toString(),
                    "ResultCode:",
                    ResultCode
                );
            }

            return acknowledgeCallback(res);
        }

        /*
         * A confirmed payment failure may release stock only
         * while the order is Pending and stock is reserved.
         */
        if (Number(ResultCode) !== 0) {
            const released = await releaseStockReservation(
                order._id,
                ResultDesc || "M-Pesa payment failed."
            );

            if (!released) {
                const currentOrder = await Order.findById(order._id)
                    .select("paymentStatus stockReserved");

                console.error(
                    "Failure callback could not release stock or the order had changed:",
                    order._id.toString(),
                    currentOrder?.paymentStatus,
                    currentOrder?.stockReserved
                );
            } else {
                console.log(
                    "Payment failure processed and stock released:",
                    order._id.toString()
                );
            }

            return acknowledgeCallback(res);
        }

        // Safaricom reported success. Validate the callback metadata.
        let reconciliationReason = null;

        if (
            typeof mpesaReceiptNumber !== "string" ||
            !mpesaReceiptNumber.trim() ||
            rawAmount === null ||
            !Number.isFinite(amountPaid) ||
            !Number.isFinite(expectedAmount)
        ) {
            reconciliationReason =
                "Successful callback has incomplete payment metadata. Manual reconciliation required.";
        } else if (amountPaid !== expectedAmount) {
            reconciliationReason =
                "Payment amount mismatch. Manual reconciliation required.";
        } else if (
            !expectedPhone ||
            !paidPhone ||
            expectedPhone !== paidPhone
        ) {
            reconciliationReason =
                "Payment phone mismatch. Manual reconciliation required.";
        }

        if (reconciliationReason) {
            /*
             * Do not mark the order Paid or release stock when
             * successful callback metadata is incomplete/mismatched.
             */
            const evidence = {
                failureReason: reconciliationReason,
                    reconciliationRequired: true,
                ...(Number.isFinite(amountPaid)
                    ? { amountPaid }
                    : {}),
                ...(typeof mpesaReceiptNumber === "string"
                    ? { mpesaReceiptNumber }
                    : {}),
                ...(phoneNumber !== null
                    ? { phoneNumber: String(phoneNumber) }
                    : {}),
                ...(transactionDate !== null
                    ? { transactionDate: String(transactionDate) }
                    : {})
            };

            const flaggedOrder = await Order.findOneAndUpdate(
                {
                    _id: order._id,
                    paymentStatus: "Pending",
                    stockReserved: true
                },
                {
                    $set: evidence
                },
                {
                    returnDocument: "after"
                }
            );

            if (!flaggedOrder) {
                console.error(
                    "Payment metadata needs reconciliation, but order state changed concurrently:",
                    order._id.toString()
                );
            } else {
                console.error(
                    reconciliationReason,
                    "Order:",
                    order._id.toString()
                );
            }

            return acknowledgeCallback(res);
        }

        /*
         * Mark the order Paid only if it remains Pending and
         * its stock reservation is still active.
         */
        const paidOrder = await Order.findOneAndUpdate(
            {
                _id: order._id,
                paymentStatus: "Pending",
                stockReserved: true
            },
            {
                $set: {
                    paymentStatus: "Paid",
                    orderStatus: "Processing",
                    reconciliationRequired: false,
                    mpesaReceiptNumber,
                    amountPaid,
                    phoneNumber: String(phoneNumber),
                    ...(transactionDate !== null
                        ? { transactionDate: String(transactionDate) }
                        : {})
                },
                $unset: {
                    failureReason: ""
                }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if (!paidOrder) {
            const currentOrder = await Order.findById(order._id)
                .select("paymentStatus stockReserved");

            console.error(
                "Could not mark payment Paid because the order changed concurrently. Reconciliation required:",
                order._id.toString(),
                currentOrder?.paymentStatus,
                currentOrder?.stockReserved
            );

            // Safaricom reported success. Never restore stock here.
            return acknowledgeCallback(res);
        }

        console.log(
            "Payment successful. Order updated:",
            paidOrder._id.toString(),
            "Receipt:",
            paidOrder.mpesaReceiptNumber
        );

        return acknowledgeCallback(res);
    } catch (error) {
        console.error("M-Pesa Callback Error:", error);

        return res.status(500).json({
            ResultCode: 1,
            ResultDesc: "Callback processing failed"
        });
    }
};
