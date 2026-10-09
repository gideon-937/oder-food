
import mongoose from "mongoose";
import Order from "../models/order.model.js";
import Food from "../models/food.model.js";

// ======================================
// CREATE ORDER AND RESERVE STOCK
// ======================================

export const createOrder = async (req, res) => {
    const { customer, items } = req.body;

    // --------------------------------------
    // VALIDATE CUSTOMER
    // --------------------------------------

    if (
        !customer ||
        typeof customer.name !== "string" ||
        typeof customer.phone !== "string"
    ) {
        return res.status(400).json({
            success: false,
            message: "Customer name and phone number are required."
        });
    }

    const customerName = customer.name.trim();
    const customerPhone = customer.phone.trim();

    if (customerName.length < 2 || customerName.length > 100) {
        return res.status(400).json({
            success: false,
            message: "Customer name must be between 2 and 100 characters."
        });
    }

    if (!customerPhone) {
        return res.status(400).json({
            success: false,
            message: "Customer phone number is required."
        });
    }

    // --------------------------------------
    // VALIDATE CART
    // --------------------------------------

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Cart is empty."
        });
    }

    if (items.length > 50) {
        return res.status(400).json({
            success: false,
            message: "Too many items in one order."
        });
    }

    // --------------------------------------
    // VALIDATE ITEMS AND COMBINE DUPLICATES
    // --------------------------------------

    const cartMap = new Map();

    for (const item of items) {
        if (
            !item ||
            typeof item.foodId !== "string" ||
            !mongoose.Types.ObjectId.isValid(item.foodId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid food item."
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
                message: "Each item quantity must be between 1 and 100."
            });
        }

        const foodId = item.foodId;
        const existingQuantity = cartMap.get(foodId) || 0;
        const combinedQuantity = existingQuantity + quantity;

        if (combinedQuantity > 100) {
            return res.status(400).json({
                success: false,
                message:
                    "The total quantity of one food item cannot exceed 100."
            });
        }

        cartMap.set(foodId, combinedQuantity);
    }

    const session = await mongoose.startSession();
    let createdOrder;

    try {
        // ======================================
        // ATOMIC STOCK RESERVATION + ORDER CREATION
        // ======================================

        await session.withTransaction(async () => {
            const foodIds = [...cartMap.keys()];

            const foods = await Food.find({
                _id: { $in: foodIds }
            })
                .session(session)
                .lean();

            const foodMap = new Map(
                foods.map(food => [
                    food._id.toString(),
                    food
                ])
            );

            const secureItems = [];
            let totalPrice = 0;

            // --------------------------------------
            // CHECK FOOD AND CALCULATE OFFICIAL PRICE
            // --------------------------------------

            for (const [foodId, quantity] of cartMap.entries()) {
                const food = foodMap.get(foodId);

                if (!food) {
                    const error = new Error(
                        "One or more food items no longer exist."
                    );
                    error.statusCode = 404;
                    throw error;
                }

                if (food.available !== true) {
                    const error = new Error(
                        `${food.name} is currently unavailable.`
                    );
                    error.statusCode = 409;
                    throw error;
                }

                const officialPrice = Number(food.price);

                if (
                    !Number.isFinite(officialPrice) ||
                    officialPrice < 0
                ) {
                    console.error(
                        "INVALID FOOD PRICE:",
                        food._id,
                        food.price
                    );

                    const error = new Error(
                        "Invalid food price configuration."
                    );
                    error.statusCode = 500;
                    throw error;
                }

                const currentStock = Number(food.stock);

                if (
                    !Number.isInteger(currentStock) ||
                    currentStock < 0
                ) {
                    const error = new Error(
                        `Stock for ${food.name} is not configured correctly.`
                    );
                    error.statusCode = 409;
                    throw error;
                }

                if (currentStock < quantity) {
                    const error = new Error(
                        `Only ${currentStock} unit(s) of ${food.name} remain.`
                    );
                    error.statusCode = 409;
                    error.code = "INSUFFICIENT_STOCK";
                    throw error;
                }

                totalPrice += officialPrice * quantity;

                secureItems.push({
                    foodId: food._id,
                    name: food.name,
                    quantity,
                    price: officialPrice
                });
            }

            totalPrice = Number(totalPrice.toFixed(2));

            // --------------------------------------
            // DEDUCT STOCK SAFELY
            // --------------------------------------

            for (const [foodId, quantity] of cartMap.entries()) {
                const updatedFood = await Food.findOneAndUpdate(
                    {
                        _id: foodId,
                        available: true,
                        stock: { $gte: quantity }
                    },
                    {
                        $inc: {
                            stock: -quantity
                        }
                    },
                    {
                        returnDocument: "after",
                        session,
                        runValidators: true
                    }
                );

                if (!updatedFood) {
                    const error = new Error(
                        "Stock changed while processing your order. Please refresh the menu and try again."
                    );

                    error.statusCode = 409;
                    error.code = "INSUFFICIENT_STOCK";
                    throw error;
                }

                // Diagnostic log: this is the updated stock
                // inside the transaction.
                console.log("STOCK DEDUCTED:", {
                    foodName: updatedFood.name,
                    foodId: updatedFood._id.toString(),
                    remainingStock: updatedFood.stock,
                    quantityOrdered: quantity
                });
            }

            // --------------------------------------
            // CREATE ORDER WITH ACTIVE RESERVATION
            // --------------------------------------

            const orders = await Order.create(
                [
                    {
                        customer: {
                            name: customerName,
                            phone: customerPhone
                        },
                        items: secureItems,
                        totalPrice,
                        paymentStatus: "Pending",
                        orderStatus: "Pending",
                        stockReserved: true
                    }
                ],
                { session }
            );

            createdOrder = orders[0];
        });

        // This log occurs after withTransaction completes.
        console.log("===== ORDER CREATED; STOCK RESERVED =====");

        console.log({
            orderId: createdOrder._id.toString(),
            totalPrice: createdOrder.totalPrice,
            itemCount: createdOrder.items.length,
            stockReserved: createdOrder.stockReserved
        });

        return res.status(201).json({
            success: true,
            message: "Order created and food stock reserved successfully.",
            order: createdOrder
        });

    } catch (error) {
        console.error("CREATE ORDER ERROR:", error);

        if (error.statusCode) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to create order. Please try again."
        });

    } finally {
        await session.endSession();
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
            message: "Failed to retrieve orders."
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
                message: "Invalid order ID."
            });
        }

        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
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
            message: "Failed to retrieve order."
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
                message: "Invalid order ID."
            });
        }

        const order = await Order.findById(id)
            .select("paymentStatus failureReason orderStatus");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        return res.status(200).json({
            success: true,
            paymentStatus: order.paymentStatus,
            failureReason: order.failureReason,
            orderStatus: order.orderStatus
        });

    } catch (error) {
        console.error("GET PAYMENT STATUS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve payment status."
        });
    }
};


// ======================================
// UPDATE ORDER
// Only allow a controlled order-status update
// ======================================

export const updateOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        const allowedOrderStatuses = [
            "Pending",
            "Processing",
            "Ready",
            "Completed",
            "Cancelled"
        ];

        if (!allowedOrderStatuses.includes(orderStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order status."
            });
        }

        const order = await Order.findByIdAndUpdate(
            id,
            {
                $set: { orderStatus }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Order status updated successfully.",
            order
        });

    } catch (error) {
        console.error("UPDATE ORDER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update order."
        });
    }
};


// ======================================
// UPDATE ORDER STATUS
// Used by kitchen
// M-Pesa controls payment status
// ======================================

export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { orderStatus, paymentStatus } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        if (paymentStatus !== undefined) {
            return res.status(400).json({
                success: false,
                message:
                    "Payment status is managed by the M-Pesa payment system."
            });
        }

        const allowedOrderStatuses = [
            "Pending",
            "Processing",
            "Ready",
            "Completed",
            "Cancelled"
        ];

        if (
            typeof orderStatus !== "string" ||
            !allowedOrderStatuses.includes(orderStatus)
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid order status."
            });
        }

        const order = await Order.findByIdAndUpdate(
            id,
            {
                $set: { orderStatus }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Order status updated successfully.",
            order
        });

    } catch (error) {
        console.error("UPDATE ORDER STATUS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update order status."
        });
    }
};


// ======================================
// DELETE ORDER
// Do not delete an order with an active
// stock reservation
// ======================================

export const deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        const order = await Order.findById(id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        if (order.stockReserved === true) {
            return res.status(409).json({
                success: false,
                message:
                    "This order still has reserved food stock. Resolve its payment status before deleting it."
            });
        }

        await Order.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Order deleted successfully."
        });

    } catch (error) {
        console.error("DELETE ORDER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete order."
        });
    }
};