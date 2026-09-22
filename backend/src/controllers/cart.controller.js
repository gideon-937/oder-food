import mongoose from "mongoose";

import Cart from "../models/cart.model.js";
import Food from "../models/food.model.js";


// ======================================
// ADD TO CART
// ======================================

export const addToCart = async (req, res) => {
    try {
        const { foodId, quantity } = req.body;

        // -------------------------------
        // Validate food ID
        // -------------------------------

        if (!foodId || !mongoose.Types.ObjectId.isValid(foodId)) {
            return res.status(400).json({
                message: "Valid food ID is required"
            });
        }

        // -------------------------------
        // Validate quantity
        // -------------------------------

        const parsedQuantity = Number(quantity);

        if (
            !Number.isInteger(parsedQuantity) ||
            parsedQuantity < 1 ||
            parsedQuantity > 100
        ) {
            return res.status(400).json({
                message: "Quantity must be an integer between 1 and 100"
            });
        }

        // -------------------------------
        // Get food from database
        // -------------------------------

        const food = await Food.findById(foodId).lean();

        if (!food) {
            return res.status(404).json({
                message: "Food not found"
            });
        }

        // -------------------------------
        // Check availability
        // -------------------------------

        if (food.available === false) {
            return res.status(400).json({
                message: "This food is currently unavailable"
            });
        }

        // -------------------------------
        // Find existing cart
        // -------------------------------

        let cart = await Cart.findOne();

        if (!cart) {
            cart = new Cart({
                items: [],
                totalAmount: 0
            });
        }

        // -------------------------------
        // Check whether food already exists
        // -------------------------------

        const existingItem = cart.items.find(
            item => item.foodId.toString() === foodId
        );

        if (existingItem) {
            const newQuantity =
                existingItem.quantity + parsedQuantity;

            if (newQuantity > 100) {
                return res.status(400).json({
                    message: "Maximum quantity for one food item is 100"
                });
            }

            existingItem.quantity = newQuantity;

        } else {

            cart.items.push({
                foodId: food._id,
                quantity: parsedQuantity
            });
        }

        // -------------------------------
        // Calculate total from DB prices
        // -------------------------------

        let totalAmount = 0;

        for (const item of cart.items) {

            const itemFood = await Food.findById(item.foodId).lean();

            if (!itemFood) {
                return res.status(400).json({
                    message: "One or more food items no longer exist"
                });
            }

            if (itemFood.available === false) {
                return res.status(400).json({
                    message: `${itemFood.name} is currently unavailable`
                });
            }

            totalAmount +=
                Number(itemFood.price) * item.quantity;
        }

        cart.totalAmount = totalAmount;

        await cart.save();

        // -------------------------------
        // Return populated cart
        // -------------------------------

        const populatedCart = await Cart.findById(cart._id)
            .populate("items.foodId");

        return res.status(201).json(populatedCart);

    } catch (error) {

        console.error("ADD TO CART ERROR:", error);

        return res.status(500).json({
            message: "Failed to add item to cart"
        });
    }
};


// ======================================
// GET CART
// ======================================

export const getCart = async (req, res) => {
    try {

        const cart = await Cart.findOne()
            .populate("items.foodId");

        if (!cart) {
            return res.json({
                items: [],
                totalAmount: 0
            });
        }

        return res.json(cart);

    } catch (error) {

        console.error("GET CART ERROR:", error);

        return res.status(500).json({
            message: "Failed to retrieve cart"
        });
    }
};