// Vercel Serverless Function: Real-Time Order Sync Relay
import localHandler from './local-orders-sync.js';

export default function handler(req, res) {
  return localHandler(req, res);
}
