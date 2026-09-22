import mongoose from "mongoose";
import Food from "../models/food.model.js";


// ======================================
// ADD FOOD
// ======================================

export const addFood = async (req, res) => {
    try {

        const {
            name,
            description,
            price,
            category
        } = req.body;

        // Validate required fields
        if (!name || !description || price === undefined || !category) {
            return res.status(400).json({
                message: "Name, description, price and category are required"
            });
        }

        // Validate name
        if (typeof name !== "string" || name.trim().length < 2) {
            return res.status(400).json({
                message: "Food name must contain at least 2 characters"
            });
        }

        // Validate description
        if (
            typeof description !== "string" ||
            description.trim().length < 2
        ) {
            return res.status(400).json({
                message: "Description is invalid"
            });
        }

        // Validate price
        const foodPrice = Number(price);

        if (!Number.isFinite(foodPrice) || foodPrice < 0) {
            return res.status(400).json({
                message: "Price must be a valid positive number"
            });
        }

        // Validate category
        if (typeof category !== "string" || category.trim().length < 1) {
            return res.status(400).json({
                message: "Category is required"
            });
        }

        // Validate available
        let available = true;

        if (req.body.available !== undefined) {

            if (
                req.body.available !== true &&
                req.body.available !== false &&
                req.body.available !== "true" &&
                req.body.available !== "false"
            ) {
                return res.status(400).json({
                    message: "Available must be true or false"
                });
            }

            available =
                req.body.available === true ||
                req.body.available === "true";
        }

        const foodData = {
            name: name.trim(),
            description: description.trim(),
            price: foodPrice,
            category: category.trim(),
            available
        };

        // Uploaded image
        if (req.file) {
            foodData.image = `/uploads/food/${req.file.filename}`;
        }

        const food = await Food.create(foodData);

        return res.status(201).json(food);

    } catch (error) {

        console.error("ADD FOOD ERROR:", error);

        return res.status(500).json({
            message: "Failed to add food"
        });
    }
};


// ======================================
// GET ALL FOODS
// ======================================

export const getFoods = async (req, res) => {
    try {

        const foods = await Food.find()
            .sort({ createdAt: -1 })
            .lean();

        return res.json(foods);

    } catch (error) {

        console.error("GET FOODS ERROR:", error);

        return res.status(500).json({
            message: "Failed to retrieve foods"
        });
    }
};


// ======================================
// GET ONE FOOD
// ======================================

export const getFood = async (req, res) => {
    try {

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid food ID"
            });
        }

        const food = await Food.findById(id).lean();

        if (!food) {
            return res.status(404).json({
                message: "Food not found"
            });
        }

        return res.json(food);

    } catch (error) {

        console.error("GET FOOD ERROR:", error);

        return res.status(500).json({
            message: "Failed to retrieve food"
        });
    }
};


// ======================================
// UPDATE FOOD
// ======================================

export const updateFood = async (req, res) => {
    try {

        const { id } = req.params;

        // Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid food ID"
            });
        }

        const updateData = {};

        // Name
        if (req.body.name !== undefined) {

            if (
                typeof req.body.name !== "string" ||
                req.body.name.trim().length < 2
            ) {
                return res.status(400).json({
                    message: "Invalid food name"
                });
            }

            updateData.name = req.body.name.trim();
        }

        // Description
        if (req.body.description !== undefined) {

            if (
                typeof req.body.description !== "string" ||
                req.body.description.trim().length < 2
            ) {
                return res.status(400).json({
                    message: "Invalid description"
                });
            }

            updateData.description = req.body.description.trim();
        }

        // Price
        if (req.body.price !== undefined) {

            const foodPrice = Number(req.body.price);

            if (!Number.isFinite(foodPrice) || foodPrice < 0) {
                return res.status(400).json({
                    message: "Price must be a valid positive number"
                });
            }

            updateData.price = foodPrice;
        }

        // Category
        if (req.body.category !== undefined) {

            if (
                typeof req.body.category !== "string" ||
                req.body.category.trim().length < 1
            ) {
                return res.status(400).json({
                    message: "Invalid category"
                });
            }

            updateData.category = req.body.category.trim();
        }

        // Available
        if (req.body.available !== undefined) {

            if (
                req.body.available !== true &&
                req.body.available !== false &&
                req.body.available !== "true" &&
                req.body.available !== "false"
            ) {
                return res.status(400).json({
                    message: "Available must be true or false"
                });
            }

            updateData.available =
                req.body.available === true ||
                req.body.available === "true";
        }

        // New image
        if (req.file) {
            updateData.image = `/uploads/food/${req.file.filename}`;
        }

        // Prevent empty update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                message: "No valid fields provided for update"
            });
        }

        const food = await Food.findByIdAndUpdate(
            id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        );

        if (!food) {
            return res.status(404).json({
                message: "Food not found"
            });
        }

        return res.json(food);

    } catch (error) {

        console.error("UPDATE FOOD ERROR:", error);

        return res.status(500).json({
            message: "Failed to update food"
        });
    }
};


// ======================================
// DELETE FOOD
// ======================================

export const deleteFood = async (req, res) => {
    try {

        const { id } = req.params;

        // Validate ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid food ID"
            });
        }

        const food = await Food.findByIdAndDelete(id);

        if (!food) {
            return res.status(404).json({
                message: "Food not found"
            });
        }

        return res.json({
            message: "Food deleted successfully"
        });

    } catch (error) {

        console.error("DELETE FOOD ERROR:", error);

        return res.status(500).json({
            message: "Failed to delete food"
        });
    }
};