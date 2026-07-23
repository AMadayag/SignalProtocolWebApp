import { Router } from "express";

const router = Router();

router.get("/:username", async (req, res) => {
    const { username } = req.params;

    // lookup user

    res.json({
        username
    });
});

export default router;
