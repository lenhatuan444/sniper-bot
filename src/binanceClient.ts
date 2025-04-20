import axios from "axios";
import crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.BINANCE_API_KEY!;
const API_SECRET = process.env.BINANCE_SECRET_KEY!;
const BASE_URL = process.env.BASE_URL!;

// Function to get the current price of a symbol (e.g., BTCUSDT)
async function getMarketPrice(symbol: string): Promise<number> {
  const url = `${BASE_URL}/fapi/v1/ticker/price?symbol=${symbol}`;
  const response = await axios.get(url);
  return parseFloat(response.data.price);
}

// Function to get the precision of a symbol
async function getSymbolPrecision(symbol: string) {
  const url = `${BASE_URL}/fapi/v1/exchangeInfo`;
  const response = await axios.get(url);
  const symbolInfo = response.data.symbols.find(
    (s: any) => s.symbol === symbol
  );
  return symbolInfo?.filters.find((f: any) => f.filterType === "LOT_SIZE")
    ?.stepSize;
}

// Function to generate a signature for API calls
function getSignature(query: string): string {
  return crypto.createHmac("sha256", API_SECRET).update(query).digest("hex");
}

// Function to set leverage for a symbol
async function setLeverage(symbol: string, leverage: number) {
  const timestamp = Date.now();
  const params = `symbol=${symbol}&leverage=${leverage}&timestamp=${timestamp}`;
  const signature = getSignature(params);
  const url = `${BASE_URL}/fapi/v1/leverage?${params}&signature=${signature}`;

  await axios.post(url, null, {
    headers: { "X-MBX-APIKEY": API_KEY },
  });
}

async function setMarginType(symbol: string, marginType: "ISOLATED") {
  const timestamp = Date.now();
  const params = `symbol=${symbol}&marginType=${marginType}&timestamp=${timestamp}`;
  const signature = getSignature(params);
  const url = `${BASE_URL}/fapi/v1/marginType?${params}&signature=${signature}`;

  try {
    await axios.post(url, null, {
      headers: { "X-MBX-APIKEY": API_KEY },
    });
  } catch (error: any) {
    if (error.response?.data?.code === -4046) {
      console.log(`[INFO] ${symbol} already in ISOLATED mode`);
    } else {
      console.error(`[ERROR] Failed to set margin type:`, error.response?.data);
      throw error;
    }
  }
}

// Function to get the position info for a symbol
async function getPositionInfo(symbol: string) {
  const timestamp = Date.now();
  const params = `timestamp=${timestamp}`;
  const signature = getSignature(params);
  const url = `${BASE_URL}/fapi/v2/positionRisk?${params}&signature=${signature}`;

  const response = await axios.get(url, {
    headers: { "X-MBX-APIKEY": API_KEY },
  });

  return response.data.find((p: any) => {
    return p.symbol === symbol;
  });
}

// Function to close a position
async function closePosition(symbol: string, positionAmt: number) {
  const side = positionAmt > 0 ? "SELL" : "BUY";
  const quantity = Math.abs(positionAmt);
  const timestamp = Date.now();
  const params = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity}&reduceOnly=true&timestamp=${timestamp}`;
  const signature = getSignature(params);
  const url = `${BASE_URL}/fapi/v1/order?${params}&signature=${signature}`;

  await axios.post(url, null, {
    headers: { "X-MBX-APIKEY": API_KEY },
  });
}

// Updated function to place a Futures order using USDT amount
export async function placeFuturesOrder(
  symbol: string,
  usdtAmount: number, // Amount in USDT
  side: "LONG" | "SHORT",
  leverage: number
) {
  // Get the current market price of the symbol
  const price = await getMarketPrice(symbol);

  // Calculate the quantity based on USDT amount and market price
  let quantity = usdtAmount / price;

  // Get the precision for the symbol
  const stepSize = await getSymbolPrecision(symbol);
  const precision = stepSize ? Math.log10(1 / parseFloat(stepSize)) : 0;

  await setMarginType(symbol, "ISOLATED");

  // Round the quantity to the correct precision
  quantity = parseFloat(quantity.toFixed(precision));

  // Set leverage for the symbol
  await setLeverage(symbol, leverage);

  // Get the current position for the symbol
  const current = await getPositionInfo(symbol);
  const currentAmt = parseFloat(current?.positionAmt || "0");

  if (currentAmt !== 0) {
    const isCurrentLong = currentAmt > 0;
    const isTriggerLong = side === "LONG";

    // Close the opposite position if one exists
    if (isCurrentLong !== isTriggerLong) {
      await closePosition(symbol, currentAmt);
    }
  }

  // Determine the order side (BUY for LONG, SELL for SHORT)
  const orderSide = side === "LONG" ? "BUY" : "SELL";
  const timestamp = Date.now();
  const params = `symbol=${symbol}&side=${orderSide}&type=MARKET&quantity=${quantity}&timestamp=${timestamp}`;
  const signature = getSignature(params);
  const url = `${BASE_URL}/fapi/v1/order?${params}&signature=${signature}`;

  const response = await axios.post(url, null, {
    headers: { "X-MBX-APIKEY": API_KEY },
  });

  return response.data;
}
