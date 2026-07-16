import express from "express";
import {
    initiatePayment,
    mpesaCallback
} from "../controllers/mpesa.controller.js";

const router = express.Router();

router.post("/stkpush", initiatePayment);
router.post("/callback", mpesaCallback);

export default router;