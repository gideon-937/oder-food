import express from "express";

import {
createOrder,
getOrders,
getOrderById,
getPaymentStatus,
updateOrderStatus,
deleteOrder
} from "../controllers/order.controller.js";

import {
protect,
kitchenOnly
} from "../middleware/auth.middleware.js";

const router = express.Router();

// ======================================
// CUSTOMER CREATES ORDER
// ======================================
router.post("/", createOrder);

// ======================================
// KITCHEN STAFF GET ALL ORDERS
// ======================================
router.get("/", protect, kitchenOnly, getOrders);

// ======================================
// CUSTOMER CHECKS PAYMENT STATUS
// ======================================
router.get("/payment-status/:id", getPaymentStatus);

// ======================================
// KITCHEN STAFF GET SINGLE ORDER
// ======================================
router.get("/:id", protect, kitchenOnly, getOrderById);

// ======================================
// KITCHEN STAFF UPDATE ORDER STATUS
// ======================================
router.put("/:id", protect, kitchenOnly, updateOrderStatus);

// ======================================
// KITCHEN STAFF DELETE CONFIRMED FAILED ORDER
// Only Failed orders with released stock
// and no successful M-Pesa receipt can be deleted.
// ======================================
router.delete("/:id", protect, kitchenOnly, deleteOrder);

export default router;
