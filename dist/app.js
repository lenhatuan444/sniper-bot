"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const binanceClient_1 = require("./binanceClient");
const dotenv_1 = __importDefault(require("dotenv"));
// Initialize dotenv to load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = 3000;
// Middleware to log incoming requests
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${JSON.stringify(req.query)}`);
    next(); // Move to the next middleware or route handler
});
// API route to place order based on USDT amount
app.post("/api/order", async (req, res) => {
    const { symbol, usdtAmount, side, leverage } = req.query;
    if (!symbol || !usdtAmount || !side || !leverage) {
        return res
            .status(400)
            .json({ error: "Missing symbol, usdtAmount, side, or leverage" });
    }
    // Validate the side parameter (must be "LONG" or "SHORT")
    const sideStr = side.toString().toUpperCase();
    if (sideStr !== "LONG" && sideStr !== "SHORT") {
        return res.status(400).json({ error: "side must be LONG or SHORT" });
    }
    // Validate leverage as a number
    const leverageInt = parseInt(leverage.toString());
    if (isNaN(leverageInt) || leverageInt < 1 || leverageInt > 125) {
        return res
            .status(400)
            .json({ error: "Invalid leverage. Must be between 1 and 125." });
    }
    try {
        // Call the function to place the futures order
        const result = await (0, binanceClient_1.placeFuturesOrder)(symbol.toString(), parseFloat(usdtAmount.toString()), // Convert the usdtAmount to a float
        sideStr, // Ensure side is either LONG or SHORT
        leverageInt);
        res.json(result);
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to place order" });
    }
});
// Start the Express server
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
