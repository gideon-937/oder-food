import mongoose from "mongoose";

const cartSchema = new mongoose.Schema(
{
    items: [
        {
            foodId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Food",
                required: true
            },
            quantity: {
                type: Number,
                required: true
            }
        }
    ],
    totalAmount: {
        type: Number,
        default: 0
    }
},
{
    timestamps: true
}
);

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;