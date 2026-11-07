"use strict";

const { Connection } = require("@solana/web3.js");
const { PmAmmClient } = require("@pm-amm/sdk");
const { PROGRAM_ID, USDC_MINT, RPC_URL } = require("./config.cjs");

let _connection = null;
let _client = null;

function getConnection() {
  if (!_connection) {
    _connection = new Connection(RPC_URL, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60_000,
    });
  }
  return _connection;
}

function getClient() {
  if (!_client) {
    _client = PmAmmClient.readOnly(getConnection(), PROGRAM_ID, USDC_MINT);
  }
  return _client;
}

module.exports = { getConnection, getClient };
