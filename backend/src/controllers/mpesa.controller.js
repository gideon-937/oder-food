import Order from "../models/order.model.js";
import { stkPush } from "../services/mpesa.js";

/**
 * Initiate M-Pesa STK Push
 */
export const initiatePayment = async (req, res) => {
    try {
        const { orderId, phone } = req.body;

        if (!orderId || !phone) {
            return res.status(400).json({
                success: false,
                message: "Order ID and phone number are required"
            });
        }

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const response = await stkPush(
            phone,
            order.totalPrice,
            order._id.toString()
        );

      order.checkoutRequestId = response.CheckoutRequestID;
order.merchantRequestId = response.MerchantRequestID;
order.paymentStatus = "Pending";

await order.save();

console.log("===== ORDER SAVED =====");
console.log(order);
        return res.status(200).json({
            success: true,
            message: "STK Push sent successfully",
            response
        });
  } catch (error) {

        console.error("STK Push Controller Error:", error.message);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};




/**
 * M-Pesa Callback
 */
export const mpesaCallback = async (req, res) => {

    try {

        console.log("===== M-PESA CALLBACK RECEIVED =====");
        console.log(JSON.stringify(req.body, null, 2));

        const callback = req.body.Body.stkCallback;

        const {
            CheckoutRequestID,
            ResultCode,
            ResultDesc,
            CallbackMetadata
        } = callback;


        // Payment failed
        if (ResultCode !== 0) {

            await Order.findOneAndUpdate(
                {
                    checkoutRequestId: CheckoutRequestID
                },
                {
                    paymentStatus: "Failed",
                    failureReason: ResultDesc
                }
            );

            console.log("Payment failed:", ResultDesc);

            return res.json({

                ResultCode: 0,
                ResultDesc: "Accepted"

            });

        }




        // Extract payment details

        const items = CallbackMetadata?.Item || [];

        const getValue = (name) => {

            const item = items.find(
                (item) => item.Name === name
            );

            return item ? item.Value : null;
        };


        const mpesaReceiptNumber = getValue(
            "MpesaReceiptNumber"
        );

        const amountPaid = getValue(
            "Amount"
        );

        const phoneNumber = getValue(
            "PhoneNumber"
        );
        const transactionDate = getValue(
            "TransactionDate"
        );



        // Update order

        const updatedOrder = await Order.findOneAndUpdate(

            {
                checkoutRequestId: CheckoutRequestID
            },

            {

                paymentStatus: "Paid",

                orderStatus: "Processing",

                mpesaReceiptNumber,

                amountPaid,

                phoneNumber,

                transactionDate

            },

        { returnDocument: "after" }
        );



        if (!updatedOrder) {

            console.log(
                "No order found for:",
                CheckoutRequestID
            );

        } else {
            console.log(
                "Payment successful. Order updated:",
                updatedOrder._id.toString()
            );

        }



        // Reply to Safaricom

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
