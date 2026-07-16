import Cart from "../models/cart.model.js";


export const addToCart = async(req,res)=>{

    try{

        const cart = await Cart.create(req.body);

        res.status(201).json(cart);

    }catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};


export const getCart = async(req,res)=>{

    try{

        const cart = await Cart.find()
        .populate("items.foodId");


        res.json(cart);


    }catch(error){

        res.status(500).json({
            message:error.message
        });

    }

};