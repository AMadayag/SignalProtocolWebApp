/**
 * POST /keys/upload
 * GET /keys/:userId
 * POST /keys/prekeys
 */

import { Router } from "express";

const router = Router();

// Upload key bundle
router.post("/upload", async (req, res) => {
  const {
    identityKey,
    signedPreKey,
    signature,
    oneTimePreKeys
  } = req.body;

  // Save to database

  res.json({
    success: true
  });
});

// Download someone else's key bundle
router.get("/:username", async (req, res) => {

  // Find an unused one-time prekey
  // Return bundle

  res.json({
    identityKey: "...",
    signedPreKey: "...",
    signature: "...",
    oneTimePreKey: "..."
  });
});

export default router;