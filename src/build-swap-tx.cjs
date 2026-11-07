"use strict";

const {
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} = require("@solana/web3.js");
const {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");
const { CU } = require("@pm-amm/sdk");
const { getClient, getConnection } = require("./client.cjs");
const { quoteSwap, minOutput, marketState } = require("./helpers/pm-amm-helpers.cjs");
const { USDC_MINT, DEFAULT_SLIPPAGE_BPS } = require("./config.cjs");

/**
 * Build an UNSIGNED swap transaction for the given wallet.
 * Creates missing ATAs (USDC, YES, NO) idempotently, then ix.swap.
 *
 * @returns {{ transactionBase64: string, message: string, quote: object }}
 */
async function buildUnsignedSwapTx({
  account, // base58 signer
  marketPda,
  marketAccount,
  side, // "yes" | "no"
  amountUsdc, // human units
  slippageBps = DEFAULT_SLIPPAGE_BPS,
}) {
  const signer = new PublicKey(account);
  const client = getClient();
  const connection = getConnection();

  const state = marketState(marketAccount);
  if (state.resolved || state.expired) {
    const err = new Error("This market is resolved or expired — no more swaps.");
    err.code = "MARKET_CLOSED";
    throw err;
  }

  const amountInMicro = Math.round(Number(amountUsdc) * 1_000_000);
  if (!Number.isFinite(amountInMicro) || amountInMicro <= 0) {
    const err = new Error("amount must be a positive number of mUSDC");
    err.code = "BAD_AMOUNT";
    throw err;
  }

  const direction = side === "no" ? "usdcToNo" : "usdcToYes";
  const q = quoteSwap(marketAccount, direction, amountInMicro);
  const minOut = minOutput(q, slippageBps);

  const yesMint = client.yesMint(marketPda);
  const noMint = client.noMint(marketPda);

  const usdcAta = getAssociatedTokenAddressSync(USDC_MINT, signer);
  const yesAta = getAssociatedTokenAddressSync(yesMint, signer);
  const noAta = getAssociatedTokenAddressSync(noMint, signer);

  const ixs = [];
  ixs.push(ComputeBudgetProgram.setComputeUnitLimit({ units: CU.HEAVY }));

  // Idempotent ATA creates — ix.swap requires BOTH YES and NO ATAs.
  for (const [mint, ata] of [
    [USDC_MINT, usdcAta],
    [yesMint, yesAta],
    [noMint, noAta],
  ]) {
    ixs.push(
      createAssociatedTokenAccountIdempotentInstruction(
        signer, // payer
        ata,
        signer, // owner
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  const swapIx = await client.ix.swap({
    signer,
    market: marketPda,
    direction,
    amountIn: amountInMicro,
    minOutput: minOut,
  });
  ixs.push(swapIx);

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.feePayer = signer;
  tx.recentBlockhash = blockhash;
  tx.add(...ixs);

  // Serialize unsigned (requireAllSignatures: false)
  const serialized = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  const outHuman = (q.out / 1_000_000).toFixed(4);
  const sideLabel = side.toUpperCase();
  return {
    transactionBase64: serialized.toString("base64"),
    message: `Buy ~${outHuman} ${sideLabel} with ${amountUsdc} mUSDC (devnet · 2% fee · ${slippageBps / 100}% slip)`,
    quote: {
      direction,
      amountInMicro,
      minOut,
      expectedOut: q.out,
      fee: q.fee,
      yesPrice: state.price,
    },
  };
}

module.exports = { buildUnsignedSwapTx };
