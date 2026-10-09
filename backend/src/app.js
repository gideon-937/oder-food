
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

import userRoutes from "./routes/user.route.js";
import foodRoutes from "./routes/food.route.js";
import orderRoutes from "./routes/order.route.js";
import cartRoutes from "./routes/cart.route.js";
import mpesaRoutes from "./routes/mpesa.route.js";

const app = express();

// ======================================
// PATH CONFIGURATION
// ======================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendPath = path.join(__dirname, "../..");
const uploadsPath = path.join(__dirname, "../../uploads");

// ======================================
// TRUST PROXY (RENDER)
// ======================================

app.set("trust proxy", 1);

// ======================================
// CORS
// Keep this before API routes.
// ======================================

const allowedOrigins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "https://oder-food-2.onrender.com",
    "https://oder-food-3.onrender.com"
];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests without an Origin header,
            // such as server-to-server requests.
            if (!origin) {
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            console.error("CORS: Origin not allowed:", origin);

            return callback(
                new Error("CORS: Origin not allowed")
            );
        },

        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS"
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]
    })
);

// ======================================
// SECURITY HEADERS
// ======================================

app.use(
    helmet({
        crossOriginResourcePolicy: {
            policy: "cross-origin"
        },

        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],

                scriptSrc: [
                    "'self'"
                ],

                styleSrc: [
                    "'self'",
                    "'unsafe-inline'"
                ],

                imgSrc: [
                    "'self'",
                    "data:",
                    "https://res.cloudinary.com"
                ],

                connectSrc: [
                    "'self'",
                    "https://oder-food-2.onrender.com",
                    "https://oder-food-3.onrender.com"
                ],

                fontSrc: [
                    "'self'",
                    "data:"
                ],

                objectSrc: [
                    "'none'"
                ],

                baseUri: [
                    "'self'"
                ],

                frameAncestors: [
                    "'self'"
                ]
            }
        }
    })
);

// ======================================
// REQUEST BODY LIMITS
// ======================================

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);

// ======================================
// RATE LIMITING
// ======================================

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,

    message: {
        message: "Too many requests. Please try again later."
    }
});

app.use("/api", apiLimiter);

// ======================================
// SERVE FRONTEND FILES
// ======================================

app.use(express.static(frontendPath));

// ======================================
// SERVE UPLOADED IMAGES
// ======================================

app.use(
    "/uploads",
    express.static(uploadsPath, {
        dotfiles: "deny",
        index: false
    })
);

// ======================================
// API ROUTES
// ======================================

app.use("/api/mpesa", mpesaRoutes);
app.use("/api/users", userRoutes);
app.use("/api/food", foodRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);

// ======================================
// 404 API HANDLER
// ======================================

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found"
    });
});

// ======================================
// ERROR HANDLER
// ======================================

app.use((error, req, res, next) => {
    console.error("SERVER ERROR:", error.message);

    if (error.message?.startsWith("CORS:")) {
        return res.status(403).json({
            success: false,
            message: "Request origin not allowed"
        });
    }

    if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
            success: false,
            message: "File is too large. Maximum size is 5MB."
        });
    }

    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

export default app;