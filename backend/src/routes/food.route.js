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
    kitchenOnly
} from "../middleware/auth.middleware.js";

import upload from "../upload.middleware.js";

const router = express.Router();


// ======================================
// PUBLIC ROUTES
// ======================================

router.get("/", getFoods);

router.get("/:id", getFood);


// ======================================
// KITCHEN-ONLY ROUTES
// ======================================

// ADD FOOD
router.post(
    "/",
    protect,
    kitchenOnly,
    upload.single("image"),
    addFood
);


// UPDATE FOOD
router.put(
    "/:id",
    protect,
    kitchenOnly,
    upload.single("image"),
    updateFood
);


// DELETE FOOD
router.delete(
    "/:id",
    protect,
    kitchenOnly,
    deleteFood
);


export default router;