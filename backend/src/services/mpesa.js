import axios from "axios";
import moment from "moment";

/**
 * ======================================
 * M-PESA CONFIGURATION
 * ======================================
 */

const MPESA_BASE_URL =
    process.env.MPESA_BASE_URL ||
    "https://sandbox.safaricom.co.ke";

const REQUIRED_ENV = [
    "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET",
    "MPESA_SHORTCODE",
    "MPESA_PASSKEY",
    "MPESA_CALLBACK_URL"
];

/**
 * Check required M-Pesa environment variables
 */
const validateMpesaConfig = () => {
    const missing = REQUIRED_ENV.filter(
        key => !process.env[key]
    );

    if (missing.length > 0) {
        throw new Error(
            `Missing M-Pesa configuration: ${missing.join(", ")}`
        );
    }
};


/**
 * ======================================
 * FORMAT PHONE NUMBER
 * ======================================
 *
 * Accepts:
 *
 * 0712345678
 * 0112345678
 * +254712345678
 * 254712345678
 *
 * Returns:
 * 2547XXXXXXXX
 * or
 * 2541XXXXXXXX
 */

export const formatPhone = (phone) => {

    if (
        phone === undefined ||
        phone === null
    ) {
        throw new Error("Phone number is required.");
    }

    let formattedPhone = String(phone).trim();

    // Remove spaces
    formattedPhone = formattedPhone.replace(/\s+/g, "");

    // Convert +254XXXXXXXXX -> 254XXXXXXXXX
    if (formattedPhone.startsWith("+254")) {
        formattedPhone = formattedPhone.substring(1);
    }

    // Convert 07XXXXXXXX -> 2547XXXXXXXX
    else if (formattedPhone.startsWith("0")) {
        formattedPhone = "254" + formattedPhone.substring(1);
    }

    // Must now be 254XXXXXXXXX
    if (!/^254[17]\d{8}$/.test(formattedPhone)) {
        throw new Error(
            "Invalid Kenyan phone number. Use 0712345678."
        );
    }

    return formattedPhone;
};


/**
 * ======================================
 * GENERATE M-PESA PASSWORD
 * ======================================
 */

export const generatePassword = () => {

    validateMpesaConfig();

    const timestamp =
        moment().format("YYYYMMDDHHmmss");

    const password = Buffer.from(
        process.env.MPESA_SHORTCODE +
        process.env.MPESA_PASSKEY +
        timestamp
    ).toString("base64");

    return {
        password,
        timestamp
    };
};


/**
 * ======================================
 * GET M-PESA ACCESS TOKEN
 * ======================================
 */

export const getAccessToken = async () => {

    try {

        validateMpesaConfig();

        const auth = Buffer.from(
            `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`
        ).toString("base64");

        const response = await axios.get(
            `${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    Accept: "application/json"
                },

                timeout: 15000
            }
        );

        const token =
            response.data?.access_token;

        if (!token) {
            throw new Error(
                "M-Pesa did not return an access token."
            );
        }

        return token;

    } catch (error) {

        console.error(
            "M-PESA ACCESS TOKEN ERROR:",
            error.response?.data ||
            error.message
        );

        throw new Error(
            "Unable to generate M-Pesa access token."
        );
    }
};


/**
 * ======================================
 * SEND STK PUSH
 * ======================================
 */

export const stkPush = async (
    phone,
    amount,
    orderId = "Food Order"
) => {

    try {

        validateMpesaConfig();

        // -------------------------------
        // Validate amount
        // -------------------------------

        const paymentAmount = Number(amount);

        if (
            !Number.isFinite(paymentAmount) ||
            !Number.isInteger(paymentAmount) ||
            paymentAmount <= 0
        ) {
            throw new Error(
                "Invalid payment amount."
            );
        }

        // -------------------------------
        // Format phone
        // -------------------------------

        const formattedPhone =
            formatPhone(phone);

        // -------------------------------
        // Validate order reference
        // -------------------------------

        if (
            !orderId ||
            typeof orderId !== "string"
        ) {
            throw new Error(
                "Invalid order reference."
            );
        }

        // Prevent excessively long references
        const accountReference =
            orderId.substring(0, 50);

        // -------------------------------
        // Get access token
        // -------------------------------

        const token =
            await getAccessToken();

        // -------------------------------
        // Generate password
        // -------------------------------

        const {
            password,
            timestamp
        } = generatePassword();

        // -------------------------------
        // STK Push payload
        // -------------------------------

        const payload = {

            BusinessShortCode:
                process.env.MPESA_SHORTCODE,

            Password:
                password,

            Timestamp:
                timestamp,

            TransactionType:
                "CustomerPayBillOnline",

            Amount:
                paymentAmount,

            PartyA:
                formattedPhone,

            PartyB:
                process.env.MPESA_SHORTCODE,

            PhoneNumber:
                formattedPhone,

            CallBackURL:
                process.env.MPESA_CALLBACK_URL,

            AccountReference:
                accountReference,

            TransactionDesc:
                "Food Payment"
        };

        // -------------------------------
        // Send request to Safaricom
        // -------------------------------

        const response = await axios.post(

            `${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`,

            payload,

            {
                headers: {
                    Authorization:
                        `Bearer ${token}`,

                    "Content-Type":
                        "application/json",

                    Accept:
                        "application/json"
                },

                timeout: 20000
            }
        );

        // -------------------------------
        // Validate response
        // -------------------------------

        if (
            !response.data ||
            !response.data.CheckoutRequestID
        ) {

            console.error(
                "INVALID M-PESA RESPONSE:",
                response.data
            );

            throw new Error(
                "Invalid response from M-Pesa."
            );
        }

        return response.data;

    } catch (error) {

        console.error(
            "M-PESA STK PUSH ERROR:",
            error.response?.data ||
            error.message
        );

        throw error;
    }
};