
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { users, workspaces, memberships } from "../db/schema";
import { eq } from "drizzle-orm";
import { validate, registerSchema, loginSchema } from "./validation";
import { authLimiter } from "./rate-limit";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export const auth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Please authenticate" });
    }

    const token = authHeader.replace("Bearer ", "");
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    const user = await db.select().from(users).where(eq(users.id, decoded.id));

    if (!user || user.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Please authenticate" });
  }
};

export const registerAuthRoutes = (app: any) => {
  app.post("/api/auth/register", authLimiter, validate(registerSchema), async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      const existingUser = await db.select().from(users).where(eq(users.email, email));
      if (existingUser.length > 0) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const workspaceName = `${email.split("@")[0]}'s workspace`;

      const [user] = await db
        .insert(users)
        .values({ email, password: hashedPassword })
        .returning();
      const [ws] = await db
        .insert(workspaces)
        .values({ name: workspaceName, ownerId: user.id })
        .returning();
      await db
        .insert(memberships)
        .values({ workspaceId: ws.id, userId: user.id, role: "owner" });

      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
      const { password: _pw, ...safeUser } = user;
      res.status(201).json({ user: safeUser, token });
    } catch (error) {
      console.error("Registration failed:", error);
      res.status(400).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const [user] = await db.select().from(users).where(eq(users.email, email));

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
      const { password: _pw, ...safeUser } = user;
      res.json({ user: safeUser, token });
    } catch (error) {
      res.status(401).json({ error: "Login failed" });
    }
  });
};
