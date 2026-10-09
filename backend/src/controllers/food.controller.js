
import mongoose from "mongoose";
import Food from "../models/food.model.js";
import Order from "../models/order.model.js";
import cloudinary from "../config/cloudinary.js";

// ======================================
// CLOUDINARY IMAGE UPLOAD
// ======================================

const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "food" },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );

        stream.end(buffer);
    });
};

// ======================================
// VALIDATE STOCK QUANTITY
// ======================================

const parseStock = (value) => {
    if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    ) {
        return {
            valid: false,
            message: "Available units are required."
        };
    }

    const stock = Number(value);

    if (!Number.isSafeInteger(stock) || stock < 0) {
        return {
            valid: false,
            message:
                "Available units must be a whole number equal to or greater than zero."
        };
    }

    return { valid: true, stock };
};

// ======================================
// VALIDATE AVAILABILITY
// ======================================

const parseAvailable = (value) => {
    if (
        value === true ||
        value === "true"
    ) {
        return { valid: true, available: true };
    }

    if (
        value === false ||
        value === "false"
    ) {
        return { valid: true, available: false };
    }

    return {
        valid: false,
        message: "Available must be true or false."
    };
};

// ======================================
// ADD FOOD
// ======================================

export const addFood = async (req, res) => {
    try {
        const {
            name,
            description,
            price,
            category,
            stock
        } = req.body;

        if (
            !name ||
            !description ||
            price === undefined ||
            !category
        ) {
            return res.status(400).json({
                message:
                    "Name, description, price and category are required."
            });
        }

        if (
            typeof name !== "string" ||
            name.trim().length < 2
        ) {
            return res.status(400).json({
                message: "Food name must contain at least 2 characters."
            });
        }

        if (
            typeof description !== "string" ||
            description.trim().length < 2
        ) {
            return res.status(400).json({
                message: "Description is invalid."
            });
        }

        const foodPrice = Number(price);

        if (!Number.isFinite(foodPrice) || foodPrice < 0) {
            return res.status(400).json({
                message: "Price must be a valid non-negative number."
            });
        }

        if (
            typeof category !== "string" ||
            category.trim().length < 1
        ) {
            return res.status(400).json({
                message: "Category is required."
            });
        }

        const stockResult = parseStock(stock);

        if (!stockResult.valid) {
            return res.status(400).json({
                message: stockResult.message
            });
        }

        let available = true;

        if (req.body.available !== undefined) {
            const availabilityResult = parseAvailable(
                req.body.available
            );

            if (!availabilityResult.valid) {
                return res.status(400).json({
                    message: availabilityResult.message
                });
            }

            available = availabilityResult.available;
        }

        const foodData = {
            name: name.trim(),
            description: description.trim(),
            price: foodPrice,
            category: category.trim(),
            stock: stockResult.stock,
            available
        };

        if (req.file) {
            const result = await uploadToCloudinary(
                req.file.buffer
            );

            foodData.image = result.secure_url;
        }

        const food = await Food.create(foodData);

        return res.status(201).json({
            success: true,
            message: "Food added successfully.",
            food
        });

    } catch (error) {
        console.error("ADD FOOD ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to add food."
        });
    }
};

// ======================================
// GET ALL FOODS
// Includes remaining stock for customers
// and kitchen dashboard
// ======================================

export const getFoods = async (req, res) => {
    try {
        const foods = await Food.find()
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json(foods);

    } catch (error) {
        console.error("GET FOODS ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve foods."
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
                message: "Invalid food ID."
            });
        }

        const food = await Food.findById(id).lean();

        if (!food) {
            return res.status(404).json({
                message: "Food not found."
            });
        }

        return res.status(200).json(food);

    } catch (error) {
        console.error("GET FOOD ERROR:", error);

        return res.status(500).json({
            message: "Failed to retrieve food."
        });
    }
};

// ======================================
// UPDATE FOOD
// Kitchen can edit food details and stock
// ======================================

export const updateFood = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid food ID."
            });
        }

        const updateData = {};

        // NAME
        if (req.body.name !== undefined) {
            if (
                typeof req.body.name !== "string" ||
                req.body.name.trim().length < 2
            ) {
                return res.status(400).json({
                    message: "Invalid food name."
                });
            }

            updateData.name = req.body.name.trim();
        }

        // DESCRIPTION
        if (req.body.description !== undefined) {
            if (
                typeof req.body.description !== "string" ||
                req.body.description.trim().length < 2
            ) {
                return res.status(400).json({
                    message: "Invalid description."
                });
            }

            updateData.description =
                req.body.description.trim();
        }

        // PRICE
        if (req.body.price !== undefined) {
            const foodPrice = Number(req.body.price);

            if (!Number.isFinite(foodPrice) || foodPrice < 0) {
                return res.status(400).json({
                    message: "Price must be a valid non-negative number."
                });
            }

            updateData.price = foodPrice;
        }

        // STOCK
        if (req.body.stock !== undefined) {
            const stockResult = parseStock(req.body.stock);

            if (!stockResult.valid) {
                return res.status(400).json({
                    message: stockResult.message
                });
            }

            updateData.stock = stockResult.stock;
        }

        // CATEGORY
        if (req.body.category !== undefined) {
            if (
                typeof req.body.category !== "string" ||
                req.body.category.trim().length < 1
            ) {
                return res.status(400).json({
                    message: "Invalid category."
                });
            }

            updateData.category = req.body.category.trim();
        }

        // AVAILABILITY
        if (req.body.available !== undefined) {
            const availabilityResult = parseAvailable(
                req.body.available
            );

            if (!availabilityResult.valid) {
                return res.status(400).json({
                    message: availabilityResult.message
                });
            }

            updateData.available =
                availabilityResult.available;
        }

        // IMAGE
        if (req.file) {
            const result = await uploadToCloudinary(
                req.file.buffer
            );

            updateData.image = result.secure_url;
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                message: "No valid fields provided for update."
            });
        }

        const food = await Food.findByIdAndUpdate(
            id,
            { $set: updateData },
            {
                new: true,
                runValidators: true
            }
        );

        if (!food) {
            return res.status(404).json({
                message: "Food not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Food updated successfully.",
            food
        });

    } catch (error) {
        console.error("UPDATE FOOD ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update food."
        });
    }
};

// ======================================
// DELETE FOOD
// Do not delete food with an active
// stock reservation
// ======================================

export const deleteFood = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid food ID."
            });
        }

        // Prevent deletion if an order still has this food reserved.
        const activeReservation = await Order.exists({
            "items.foodId": new mongoose.Types.ObjectId(id),
            stockReserved: true
        });

        if (activeReservation) {
            return res.status(409).json({
                success: false,
                message:
                    "This food item belongs to an order with a pending stock reservation. Resolve the payment status before deleting it."
            });
        }

        const food = await Food.findByIdAndDelete(id);

        if (!food) {
            return res.status(404).json({
                message: "Food not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Food deleted successfully."
        });

    } catch (error) {
        console.error("DELETE FOOD ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete food."
        });
    }
};