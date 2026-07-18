import Order from "../models/order.model.js";

export const createOrder = async (req, res) => {
    try {

        const { customer, items } = req.body;

        // Check customer phone
        if (!customer || !customer.phone) {
            return res.status(400).json({
                success: false,
                message: "Customer phone number is required"
            });
        }

        // Check cart items
        if (!items || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cart is empty"
            });
        }

        let totalPrice = 0;

        items.forEach(item => {
            totalPrice += item.price * item.quantity;
        });

        const order = await Order.create({
            customer,
            items,
            totalPrice,
            paymentStatus: "Pending",
            orderStatus: "Pending"
        });

        res.status(201).json({
            success: true,
            message: "Order created successfully",
            order
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all orders
export const getOrders = async (req, res) => {
    try {

        const orders = await Order.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: orders.length,
            orders
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get a single order (used for checking payment status)
export const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.status(200).json({
            success: true,
            order
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update order
export const updateOrder = async (req, res) => {
    try {
        const order = await Order.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.status(200).json({
            success: true,
            order
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const updateOrderStatus = async (req, res) => {
    try {
        const { orderStatus, paymentStatus } = req.body;

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            {
                orderStatus,
                paymentStatus
            },
            {
                new: true
            }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.json({
            success: true,
            message: "Order updated successfully",
            order
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete order
export const deleteOrder = async (req, res) => {
    try {
        await Order.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: "Order deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};