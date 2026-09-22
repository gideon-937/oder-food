import mongoose from "mongoose";

const foodSchema = new mongoose.Schema({

    name:{
        type:String,
        required:true
    },

    description:{
        type:String,
        required:true
    },

    price:{
        type:Number,
        required:true
    },

    image:{
        type:String
    },

    category:{
    type:String
},

available:{
    type:Boolean,
    default:true
}

},{timestamps:true});

export default mongoose.model("Food",foodSchema);