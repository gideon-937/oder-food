

import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Food from "../models/food.model.js";


// ======================================
// CREATE ORDER
// ======================================
export const createOrder = async (req, res) => {
    try {

        const { customer, items } = req.body;

        // ======================================
        // VALIDATE CUSTOMER
        // ======================================

        if (
            !customer ||
            typeof customer.name !== "string" ||
            typeof customer.phone !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Customer name and phone number are required"
            });
        }

        const customerName = customer.name.trim();
        const customerPhone = customer.phone.trim();

        if (customerName.length < 2 || customerName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Customer name must be between 2 and 100 characters"
            });
        }

        if (!customerPhone) {
            return res.status(400).json({
                success: false,
                message: "Customer phone number is required"
            });
        }


        // ======================================
        // VALIDATE CART
        // ======================================

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cart is empty"
            });
        }

        // Prevent extremely large carts
        if (items.length > 50) {
            return res.status(400).json({
                success: false,
                message: "Too many items in one order"
            });
        }


        // ======================================
        // VALIDATE ITEM IDs
        // ======================================

        for (const item of items) {

            if (
                !item ||
                typeof item.foodId !== "string" ||
                !mongoose.Types.ObjectId.isValid(item.foodId)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid food item"
                });
            }

            const quantity = Number(item.quantity);

            if (
                !Number.isInteger(quantity) ||
                quantity < 1 ||
                quantity > 100
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid item quantity"
                });
            }
        }


        // ======================================
        // GET OFFICIAL FOOD DATA
        // ======================================

        const foodIds = items.map(item => item.foodId);

        const foods = await Food.find({
            _id: { $in: foodIds }
        }).lean();

        // Make lookup map
        const foodMap = new Map(
            foods.map(food => [
                food._id.toString(),
                food
            ])
        );


        // ======================================
        // BUILD SECURE ORDER ITEMS
        // ======================================

        const secureItems = [];
        let totalPrice = 0;

        for (const item of items) {

            const food = foodMap.get(item.foodId);

            // Food does not exist
            if (!food) {
                return res.status(404).json({
                    success: false,
                    message: "One or more food items no longer exist"
                });
            }


            // Food is unavailable
            if (food.available !== true) {
                return res.status(400).json({
                    success: false,
                    message: `${food.name} is currently unavailable`
                });
            }


            const quantity = Number(item.quantity);

            // IMPORTANT:
            // Never use item.price from the customer.
            // Always use the price stored in MongoDB.

            const officialPrice = Number(food.price);

            if (!Number.isFinite(officialPrice) || officialPrice < 0) {
                console.error(
                    "INVALID FOOD PRICE:",
                    food._id,
                    food.price
                );

                return res.status(500).json({
                    success: false,
                    message: "Invalid food price configuration"
                });
            }


            // Calculate using SERVER price
            totalPrice += officialPrice * quantity;


            // Store trusted information in the order
            secureItems.push({
                name: food.name,
                quantity,
                price: officialPrice
            });
        }


        // ======================================
        // ROUND TOTAL
        // ======================================

        totalPrice = Number(totalPrice.toFixed(2));


        // ======================================
        // CREATE ORDER
        // ======================================

        const order = await Order.create({

            customer: {
                name: customerName,
                phone: customerPhone
            },

            items: secureItems,

            totalPrice,

            paymentStatus: "Pending",

            orderStatus: "Pending"
        });


        console.log("===== SECURE ORDER CREATED =====");
        console.log({
            orderId: order._id,
            totalPrice: order.totalPrice,
            itemCount: order.items.length
        });


        // ======================================
        // RESPONSE
        // ======================================

        return res.status(201).json({
            success: true,
            message: "Order created successfully",
            order
        });

    } catch (error) {

        console.error("CREATE ORDER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create order"
        });
    }
};



// ======================================
// GET ALL ORDERS
// ======================================
export const getOrders = async (req, res) => {
    try {

        const orders = await Order.find()
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: orders.length,
            orders
        });

    } catch (error) {

        console.error("GET ORDERS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve orders"
        });
    }
};



// ======================================
// GET SINGLE ORDER BY ID
// Used by kitchen
// ======================================
export const getOrderById = async (req, res) => {
    try {

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        return res.status(200).json({
            success: true,
            order
        });

    } catch (error) {

        console.error("GET ORDER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve order"
        });
    }
};



// ======================================
// GET PAYMENT STATUS
// Used by customer
// ======================================
export const getPaymentStatus = async (req, res) => {
    try {

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        const order = await Order.findById(id)
            .select("paymentStatus");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        return res.status(200).json({
            success: true,
            paymentStatus: order.paymentStatus
        });

    } catch (error) {

        console.error("GET PAYMENT STATUS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve payment status"
        });
    }
};



// ======================================
// UPDATE ORDER
// ======================================
export const updateOrder = async (req, res) => {
    try {

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        const order = await Order.findByIdAndUpdate(
            id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        return res.status(200).json({
            success: true,
            order
        });

    } catch (error) {

        console.error("UPDATE ORDER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update order"
        });
    }
};



// ======================================
// UPDATE ORDER STATUS
// Used by kitchen
// ======================================
export const updateOrderStatus = async (req, res) => {
    try {

        const { id } = req.params;
        const { orderStatus, paymentStatus } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }


        // Validate order status if supplied
        const allowedOrderStatuses = [
            "Pending",
            "Processing",
            "Ready",
            "Completed",
            "Cancelled"
        ];

        if (
            orderStatus !== undefined &&
            !allowedOrderStatuses.includes(orderStatus)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid order status"
            });
        }


        // Validate payment status if supplied
        const allowedPaymentStatuses = [
            "Pending",
            "Paid",
            "Failed"
        ];

        if (
            paymentStatus !== undefined &&
            !allowedPaymentStatuses.includes(paymentStatus)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment status"
            });
        }


        // Build update safely
        const updateData = {};

        if (orderStatus !== undefined) {
            updateData.orderStatus = orderStatus;
        }

        if (paymentStatus !== undefined) {
            updateData.paymentStatus = paymentStatus;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid status provided"
            });
        }


        const order = await Order.findByIdAndUpdate(
            id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        return res.json({
            success: true,
            message: "Order updated successfully",
            order
        });

    } catch (error) {

        console.error("UPDATE ORDER STATUS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update order"
        });
    }
};



// ======================================
// DELETE ORDER
// ======================================
export const deleteOrder = async (req, res) => {
    try {

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        const order = await Order.findByIdAndDelete(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Order deleted successfully"
        });

    } catch (error) {

        console.error("DELETE ORDER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete order"
        });
    }
};

