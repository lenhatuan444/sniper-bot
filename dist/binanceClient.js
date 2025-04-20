"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.placeFuturesOrder = placeFuturesOrder;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_SECRET_KEY;
const BASE_URL = process.env.BASE_URL;
// Function to get the current price of a symbol (e.g., BTCUSDT)
async function getMarketPrice(symbol) {
    const url = `${BASE_URL}/fapi/v1/ticker/price?symbol=${symbol}`;
    const response = await axios_1.default.get(url);
    return parseFloat(response.data.price);
}
// Function to get the precision of a symbol
async function getSymbolPrecision(symbol) {
    const url = `${BASE_URL}/fapi/v1/exchangeInfo`;
    const response = await axios_1.default.get(url);
    const symbolInfo = response.data.symbols.find((s) => s.symbol === symbol);
    return symbolInfo?.filters.find((f) => f.filterType === "LOT_SIZE")
        ?.stepSize;
}
// Function to generate a signature for API calls
function getSignature(query) {
    return crypto_1.default.createHmac("sha256", API_SECRET).update(query).digest("hex");
}
// Function to set leverage for a symbol
async function setLeverage(symbol, leverage) {
    const timestamp = Date.now();
    const params = `symbol=${symbol}&leverage=${leverage}&timestamp=${timestamp}`;
    const signature = getSignature(params);
    const url = `${BASE_URL}/fapi/v1/leverage?${params}&signature=${signature}`;
    await axios_1.default.post(url, null, {
        headers: { "X-MBX-APIKEY": API_KEY },
    });
}
async function setMarginType(symbol, marginType) {
    const timestamp = Date.now();
    const params = `symbol=${symbol}&marginType=${marginType}&timestamp=${timestamp}`;
    const signature = getSignature(params);
    const url = `${BASE_URL}/fapi/v1/marginType?${params}&signature=${signature}`;
    try {
        await axios_1.default.post(url, null, {
            headers: { "X-MBX-APIKEY": API_KEY },
        });
    }
    catch (error) {
        if (error.response?.data?.code === -4046) {
            console.log(`[INFO] ${symbol} already in ISOLATED mode`);
        }
        else {
            console.error(`[ERROR] Failed to set margin type:`, error.response?.data);
            throw error;
        }
    }
}
// Function to get the position info for a symbol
async function getPositionInfo(symbol) {
    const timestamp = Date.now();
    const params = `timestamp=${timestamp}`;
    const signature = getSignature(params);
    const url = `${BASE_URL}/fapi/v2/positionRisk?${params}&signature=${signature}`;
    const response = await axios_1.default.get(url, {
        headers: { "X-MBX-APIKEY": API_KEY },
    });
    return response.data.find((p) => {
        return p.symbol === symbol;
    });
}
// Function to close a position
async function closePosition(symbol, positionAmt) {
    const side = positionAmt > 0 ? "SELL" : "BUY";
    const quantity = Math.abs(positionAmt);
    const timestamp = Date.now();
    const params = `symbol=${symbol}&side=${side}&type=MARKET&quantity=${quantity}&reduceOnly=true&timestamp=${timestamp}`;
    const signature = getSignature(params);
    const url = `${BASE_URL}/fapi/v1/order?${params}&signature=${signature}`;
    await axios_1.default.post(url, null, {
        headers: { "X-MBX-APIKEY": API_KEY },
    });
}
// Updated function to place a Futures order using USDT amount
async function placeFuturesOrder(symbol, usdtAmount, // Amount in USDT
side, leverage) {
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
    const response = await axios_1.default.post(url, null, {
        headers: { "X-MBX-APIKEY": API_KEY },
    });
    return response.data;
}
