import express from "express";

import {
    addFood,
    getFoods,
    getFood,
    updateFood,
    deleteFood
} from "../controllers/food.controller.js";

import {
    protect,
    adminOnly
} from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.get("/", getFoods);

router.get("/:id", getFood);

// Admin-only routes
router.post("/", protect, adminOnly, addFood);

router.put("/:id", protect, adminOnly, updateFood);

router.delete("/:id", protect, adminOnly, deleteFood);

export default router;