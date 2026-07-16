import Order from "../models/order.model.js";
import { stkPush } from "../services/mpesa.js";

export const initiatePayment = async (req, res) => {
    try {
        const { orderId, phone } = req.body;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const response = await stkPush(phone, order.totalPrice, order._id.toString());

        order.checkoutRequestId = response.CheckoutRequestID;
        order.merchantRequestId = response.MerchantRequestID;
        order.paymentStatus = "Pending";
        await order.save();

        res.status(200).json({
            success: true,
            message: "STK Push sent successfully.",
            response
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const mpesaCallback = async (req, res) => {
    try {
        console.log(JSON.stringify(req.body, null, 2));

        const callback = req.body.Body.stkCallback;

        res.json({ ResultCode: 0, ResultDesc: "Accepted" });

        const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

        if (ResultCode !== 0) {
            console.log("Payment failed or cancelled:", ResultDesc);
            await Order.findOneAndUpdate(
                { checkoutRequestId: CheckoutRequestID },
                { paymentStatus: "Failed", failureReason: ResultDesc }
            );
            return;
        }

        const items = CallbackMetadata?.Item || [];
        const getValue = (name) => items.find((i) => i.Name === name)?.Value;

        const updatedOrder = await Order.findOneAndUpdate(
            { checkoutRequestId: CheckoutRequestID },
            {
                paymentStatus: "Paid",
                mpesaReceiptNumber: getValue("MpesaReceiptNumber"),
                amountPaid: getValue("Amount"),
                phoneNumber: getValue("PhoneNumber"),
                transactionDate: getValue("TransactionDate")
            },
            { new: true }
        );

        if (!updatedOrder) {
            console.log("⚠️ No matching order found for CheckoutRequestID:", CheckoutRequestID);
        } else {
            console.log("✅ Payment successful, order updated:", updatedOrder._id.toString());
        }

    } catch (error) {
        console.log(error.message);
    }
};