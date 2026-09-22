import express from "express";
import rateLimit from "express-rate-limit";

import {
    initiatePayment,
    mpesaCallback
} from "../controllers/mpesa.controller.js";

const router = express.Router();


// ======================================
// STK PUSH RATE LIMITER
// ======================================

const stkPushLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    // Maximum STK requests from one IP
    max: 10,

    standardHeaders: true,

    legacyHeaders: false,

    message: {
        message: "Too many payment requests. Please try again later."
    }
});


// ======================================
// STK PUSH
// ======================================

router.post(
    "/stkpush",
    stkPushLimiter,
    initiatePayment
);


// ======================================
// M-PESA CALLBACK
// ======================================

// DO NOT put authentication here.
// Safaricom needs to access this endpoint.
router.post(
    "/callback",
    mpesaCallback
);


export default router;