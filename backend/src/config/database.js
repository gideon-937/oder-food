import mongoose from "mongoose";

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected successfully");
        console.log("DATABASE NAME:", mongoose.connection.name);
        console.log("DATABASE HOST:", mongoose.connection.host);

    } catch (error) {
        console.log("MongoDB connection failed:", error.message);
        process.exit(1);
    }
};

export default connectDB;