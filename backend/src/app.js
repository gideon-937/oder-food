
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

// Frontend files currently reside in the project root.
const frontendPath = path.resolve(__dirname, "../..");
const uploadsPath = path.resolve(__dirname, "../../uploads");

// ======================================
// TRUST PROXY (RENDER)
// ======================================

app.set("trust proxy", 1);

// ======================================
// CORS
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
            // Allow requests without an Origin header.
            // Authentication and authorization must still
            // be enforced by protected API routes.
            if (!origin) {
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("CORS: Origin not allowed"));
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

                scriptSrc: ["'self'"],

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

                objectSrc: ["'none'"],

                baseUri: ["'self'"],

                frameAncestors: ["'self'"]
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
// GENERAL API RATE LIMITING
// ======================================

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,

    message: {
        success: false,
        message: "Too many requests. Please try again later."
    }
});

app.use("/api", apiLimiter);

// ======================================
// BLOCK PRIVATE PROJECT FILES
// IMPORTANT: Must run before express.static()
// ======================================

const blockedPrefixes = [
    "/backend",
    "/node_modules",
    "/.git",
    "/.vscode",
    "/.idea",
    "/.github",
    "/coverage",
    "/test",
    "/tests"
];

const blockedFiles = new Set([
    "/.env",
    "/.env.example",
    "/.env.local",
    "/.env.production",
    "/.env.development",
    "/package.json",
    "/package-lock.json",
    "/npm-shrinkwrap.json",
    "/yarn.lock",
    "/pnpm-lock.yaml",
    "/.gitignore",
    "/.gitattributes",
    "/.gitmodules",
    "/dockerfile",
    "/docker-compose.yml",
    "/docker-compose.yaml"
]);

app.use((req, res, next) => {
    let requestPath;

    try {
        // Decode the URL to help prevent encoded-path bypasses.
        requestPath = decodeURIComponent(req.path).toLowerCase();
    } catch {
        return res.sendStatus(400);
    }

    const isBlockedPrefix = blockedPrefixes.some(
        (prefix) =>
            requestPath === prefix ||
            requestPath.startsWith(`${prefix}/`)
    );

    const isBlockedFile = blockedFiles.has(requestPath);

    // Prevent access to private files and directories.
    if (isBlockedPrefix || isBlockedFile) {
        return res.sendStatus(404);
    }

    next();
});

// ======================================
// SERVE FRONTEND FILES
// ======================================

// Keep this after the private-path protection above.
app.use(
    express.static(frontendPath, {
        dotfiles: "deny",
        index: "index.html",
        redirect: false
    })
);

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
    return res.status(404).json({
        success: false,
        message: "API endpoint not found"
    });
});

// ======================================
// 404 HANDLER FOR OTHER REQUESTS
// ======================================

app.use((req, res) => {
    return res.status(404).send("Not found");
});

// ======================================
// ERROR HANDLER
// ======================================

app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    if (error.message?.startsWith("CORS:")) {
        return res.status(403).json({
            success: false,
            message: "Request origin not allowed"
        });
    }

    if (error.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            message: "Request body is too large."
        });
    }

    if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
            success: false,
            message: "File is too large. Maximum size is 5MB."
        });
    }

    console.error("SERVER ERROR:", error.message);

    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

export default app;
