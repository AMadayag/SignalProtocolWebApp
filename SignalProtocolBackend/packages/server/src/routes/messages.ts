import { Router } from "express";

const router = Router();

// Send encrypted message
router.post("/", async (req, res) => {

    const {
        recipient,
        ciphertext,
        type
    } = req.body;

    // Store message
    // Deliver over websocket if online

    res.json({
        success: true
    });
});

// Retrieve queued messages
router.get("/pending", async (req, res) => {
    // try {
    //     const db = getDatabase();

    //     // Temporary: replace with auth later
    //     const deviceId = Number(req.query.deviceId);

    //     if (!deviceId) {
    //         return res.status(400).json({
    //             error: "deviceId required"
    //         });
    //     }

    //     const messages = db.prepare(`
    //         SELECT *
    //         FROM messages
    //         WHERE recipient_device = ?
    //         AND delivered = 0
    //     `).all(deviceId);

    //     db.prepare(`
    //         UPDATE messages
    //         SET delivered = 1
    //         WHERE recipient_device = ?
    //         AND delivered = 0
    //     `).run(deviceId);

    //     res.json(messages);

    // } catch (error) {
    //     console.error(error);

    //     res.status(500).json({
    //         error: "Server error"
    //     });
    // }
});

export default router;
