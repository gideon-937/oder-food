import express from "express";
import cors from "cors";

import userRoutes from "./routes/user.route.js";
import foodRoutes from "./routes/food.route.js";
import orderRoutes from "./routes/order.route.js";
import cartRoutes from "./routes/cart.route.js";
import mpesaRoutes from "./routes/mpesa.route.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.json({ message: "Hotel Food Ordering API Running..." });
});

app.use("/api/mpesa", mpesaRoutes);
app.use("/api/users", userRoutes);
app.use("/api/foods", foodRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/cart", cartRoutes);

export default app;