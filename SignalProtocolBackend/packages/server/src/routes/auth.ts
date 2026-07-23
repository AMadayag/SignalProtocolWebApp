import { Router } from "express";
import { hashPassword } from "../services/authServices";
import { prisma } from "../db/prisma";

const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
    const { username, password } = req.body;

    // TODO:
    // validate input

    const hashed = await hashPassword(password);

    // insert user
    try {
        const user = await prisma.user.create({
            data: {
              username,
              password: hashed
            }
          });

    } catch (e) {
        console.error(e)

        res.status(500).json({
            message: "Failed to create user"
        });
        return;
    }

    res.status(201).json({
        message: "User created"
    });
});

authRouter.post("/login", async (req, res) => {
    const { username, password } = req.body;

    // TODO:
    // verify password
    // create JWT

    res.json({
        token: "jwt-token"
    });
});

export default authRouter
