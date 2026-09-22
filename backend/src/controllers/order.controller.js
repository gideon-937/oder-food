import Order from "../models/order.model.js";


// ======================================
// CREATE ORDER
// ======================================
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

        // Calculate total price
        let totalPrice = 0;

        items.forEach(item => {
            totalPrice += item.price * item.quantity;
        });

        // Create order
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


// ======================================
// GET ALL ORDERS
// ======================================
export const getOrders = async (req, res) => {
    try {

        const orders = await Order.find()
            .sort({ createdAt: -1 });

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


// ======================================
// GET SINGLE ORDER BY ID
// Used by kitchen
// ======================================
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


// ======================================
// GET PAYMENT STATUS
// Used by customer
// ======================================
export const getPaymentStatus = async (req, res) => {
    try {

        const order = await Order.findById(req.params.id)
            .select("paymentStatus");

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.status(200).json({
            success: true,
            paymentStatus: order.paymentStatus
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


// ======================================
// UPDATE ORDER
// ======================================
export const updateOrder = async (req, res) => {
    try {

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

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


// ======================================
// UPDATE ORDER STATUS
// Used by kitchen
// ======================================
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


// ======================================
// DELETE ORDER
// ======================================
export const deleteOrder = async (req, res) => {
    try {

        const order = await Order.findByIdAndDelete(
            req.params.id
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

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