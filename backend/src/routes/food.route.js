import express from "express";

import {

    addFood,
    getFoods,
    getFood,
    updateFood,
    deleteFood

} from "../controllers/food.controller.js";

const router = express.Router();

router.post("/", addFood);

router.get("/", getFoods);

router.get("/:id", getFood);

router.put("/:id", updateFood);

router.delete("/:id", deleteFood);

export default router;