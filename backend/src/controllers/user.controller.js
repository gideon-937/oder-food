
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

console.log("🔥 CORRECT USER CONTROLLER LOADED");

// ======================================
// REGISTER USER
// ======================================

export const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const userExists = await User.findOne({
            email: normalizedEmail
        });

        if (userExists) {
            return res.status(400).json({
                success: false,
                message: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword
        });

        return res.status(201).json({
            success: true,
            message: "Registration successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("REGISTER ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Registration failed"
        });
    }
};


// ======================================
// LOGIN USER
// ======================================

export const loginUser = async (req, res) => {
    try {

        console.log("=================================");
        console.log("LOGIN REQUEST");

        const { email, password } = req.body || {};

        console.log("Email:", email);

        console.log(
            "Password received:",
            typeof password === "string" && password.length > 0
                ? "YES"
                : "NO"
        );

        // ======================================
        // VALIDATE INPUT
        // ======================================

        if (
            typeof email !== "string" ||
            !email.trim() ||
            typeof password !== "string" ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // ======================================
        // FIND USER
        // ======================================

        const user = await User.findOne({
            email: normalizedEmail
        }).select("+password");

        console.log("User found:", !!user);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // ======================================
        // CHECK USER DATA
        // ======================================

        console.log("User email:", user.email);
        console.log("User role:", user.role);
        console.log("Password exists:", !!user.password);
        console.log(
            "Password length:",
            user.password ? user.password.length : 0
        );

        if (
            typeof user.password !== "string" ||
            !user.password.trim()
        ) {
            console.error("ERROR: USER PASSWORD IS MISSING");

            return res.status(500).json({
                success: false,
                message: "User password is missing"
            });
        }

        // ======================================
        // COMPARE PASSWORD
        // ======================================

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        console.log("Password match:", passwordMatch);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Wrong password"
            });
        }

        // ======================================
        // CHECK JWT SECRET
        // ======================================

        if (
            typeof process.env.JWT_SECRET !== "string" ||
            !process.env.JWT_SECRET.trim()
        ) {
            console.error("ERROR: JWT_SECRET is missing");

            return res.status(500).json({
                success: false,
                message: "JWT configuration error"
            });
        }

        // ======================================
        // CREATE JWT
        // ======================================

        const token = jwt.sign(
            {
                id: user._id.toString(),
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

        // ======================================
        // LOGIN SUCCESS
        // ======================================

        console.log("LOGIN SUCCESSFUL");
        console.log("Role:", user.role);
        console.log("=================================");

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {

        console.error("LOGIN ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Login failed"
        });
    }
};

