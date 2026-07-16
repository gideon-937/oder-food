import Food from "../models/food.model.js";

// Add Food

export const addFood = async (req, res) => {

    try {

        const food = await Food.create(req.body);

        res.status(201).json(food);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};


// Get Foods

export const getFoods = async (req, res) => {

    try {

        const foods = await Food.find();

        res.json(foods);

    } catch (error) {

        res.status(500).json({
            message: error.message
        });

    }

};


// Get One Food

export const getFood = async (req, res) => {

    const food = await Food.findById(req.params.id);

    res.json(food);

};


// Update Food

export const updateFood = async (req, res) => {

    const food = await Food.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
    );

    res.json(food);

};


// Delete Food

export const deleteFood = async (req, res) => {

    await Food.findByIdAndDelete(req.params.id);

    res.json({
        message: "Food deleted"
    });

};