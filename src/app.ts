import express from "express";
import { placeFuturesOrder } from "./binanceClient";
import dotenv from "dotenv";

// Initialize dotenv to load environment variables
dotenv.config();
const app = express();
const port = 3000;

// Middleware to log incoming requests
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.url} - ${JSON.stringify(
      req.query
    )}`
  );
  next(); // Move to the next middleware or route handler
});

// API route to place order based on USDT amount
app.post("/api/order", async (req: any, res: any) => {
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
    const result = await placeFuturesOrder(
      symbol.toString(),
      parseFloat(usdtAmount.toString()), // Convert the usdtAmount to a float
      sideStr as "LONG" | "SHORT", // Ensure side is either LONG or SHORT
      leverageInt
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
