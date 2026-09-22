import jwt from "jsonwebtoken";
import User from "../models/user.model.js";


// ======================================
// VERIFY JWT TOKEN
// ======================================

export const protect = async (req, res, next) => {
    try {

        // Make sure JWT secret exists
        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET is missing");

            return res.status(500).json({
                message: "Server configuration error"
            });
        }

        const authHeader = req.headers.authorization;

        // Check Authorization header
        if (
            !authHeader ||
            typeof authHeader !== "string" ||
            !authHeader.startsWith("Bearer ")
        ) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        // Extract token
        const token = authHeader.substring(7).trim();

        if (!token) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        // Verify token
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Make sure token contains a user ID
        if (!decoded || !decoded.id) {
            return res.status(401).json({
                message: "Invalid authentication token"
            });
        }

        // Find user
        const user = await User.findById(decoded.id)
            .select("-password")
            .lean();

        if (!user) {
            return res.status(401).json({
                message: "User not found"
            });
        }

        // Attach authenticated user
        req.user = user;

        next();

    } catch (error) {

        console.error("AUTH ERROR:", error.message);

        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
};


// ======================================
// KITCHEN ONLY
// ======================================

export const kitchenOnly = (req, res, next) => {

    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    if (req.user.role !== "kitchen") {
        return res.status(403).json({
            message: "Kitchen access denied"
        });
    }

    next();
};


// ======================================
// ADMIN ONLY
// ======================================

export const adminOnly = (req, res, next) => {

    if (!req.user) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    if (req.user.role !== "admin") {
        return res.status(403).json({
            message: "Admin access denied"
        });
    }

    next();
};