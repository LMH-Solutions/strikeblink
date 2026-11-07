"use strict";

const { PublicKey } = require("@solana/web3.js");

/** PREDICT pm-AMM program (same ID on devnet + mainnet; we only use devnet). */
const PROGRAM_ID = new PublicKey("GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y");

/** Devnet mock USDC (mUSDC), 6 decimals. Never use mainnet USDC mint here. */
const USDC_MINT = new PublicKey("3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ");

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const PORT = Number(process.env.PORT || 8787);
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
const FAUCET_URL = "https://pm-amm-devnet.vercel.app/api/faucet";
const REF_APP = "https://pm-amm-devnet.vercel.app";
const MARKET_DATA_SIZE = 443;
const DEFAULT_SLIPPAGE_BPS = 100; // 1%
const DEFAULT_AMOUNT_USDC = 5;

module.exports = {
  PROGRAM_ID,
  USDC_MINT,
  RPC_URL,
  PORT,
  PUBLIC_BASE_URL,
  FAUCET_URL,
  REF_APP,
  MARKET_DATA_SIZE,
  DEFAULT_SLIPPAGE_BPS,
  DEFAULT_AMOUNT_USDC,
};
