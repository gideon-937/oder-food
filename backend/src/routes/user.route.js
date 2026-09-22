import express from "express";
import rateLimit from "express-rate-limit";

import {
    registerUser,
    loginUser
} from "../controllers/user.controller.js";

const router = express.Router();


// ======================================
// AUTH RATE LIMITER
// ======================================

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    // Maximum authentication attempts
    max: 10,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
        message: "Too many authentication attempts. Please try again later."
    }
});


// ======================================
// REGISTER
// ======================================

router.post(
    "/register",
    authLimiter,
    registerUser
);


// ======================================
// LOGIN
// ======================================

router.post(
    "/login",
    authLimiter,
    loginUser
);


export default router;