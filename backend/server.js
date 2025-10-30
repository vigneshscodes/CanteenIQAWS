import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ddb } from "./db/db.js"; // DynamoDB client
import {
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

dotenv.config();
const app = express();

// =======================
// MIDDLEWARE
// =======================
app.use(cors());
app.use(express.json());

// =======================
// JWT AUTH MIDDLEWARE
// =======================
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Access denied. No token." });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: "Invalid token" });
  }
};

// =======================
// USER SIGNUP
// =======================
app.post("/api/users", async (req, res) => {
  try {
    const { fullname, contactnumber, email, password } = req.body;

    if (!fullname || !contactnumber || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await ddb.send(
      new GetCommand({ TableName: "users", Key: { email } })
    );
    if (existingUser.Item) {
      return res.status(400).json({ message: "User already exists" });
    }

    const passwordhash = await bcrypt.hash(password, 10);

    const newUser = {
      email,
      fullname,
      contactnumber,
      passwordhash,
      createdat: new Date().toISOString(),
      lastlogin: null,
    };

    await ddb.send(new PutCommand({ TableName: "users", Item: newUser }));

    res.status(201).json({
      message: "Signup successful",
      user: { email, fullname, contactnumber },
    });
  } catch (err) {
    console.error("Error in /api/users:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =======================
// USER LOGIN
// =======================
app.post("/api/users/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await ddb.send(
      new GetCommand({ TableName: "users", Key: { email } })
    );

    const user = result.Item;
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.passwordhash);
    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // Update last login timestamp
    await ddb.send(
      new UpdateCommand({
        TableName: "users",
        Key: { email },
        UpdateExpression: "set lastlogin = :t",
        ExpressionAttributeValues: { ":t": new Date().toISOString() },
      })
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        email: user.email,
        fullname: user.fullname,
        contactnumber: user.contactnumber,
      },
    });
  } catch (err) {
    console.error("Error in /api/users/login:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =======================
// ITEMS ROUTES
// =======================
app.get("/api/items", async (req, res) => {
  try {
    const data = await ddb.send(new ScanCommand({ TableName: "items" }));
    res.json(data.Items || []);
  } catch (err) {
    console.error("Error in /api/items:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/items/:id", async (req, res) => {
  const { id } = req.params;
  const { availableQty } = req.body;

  if (availableQty == null)
    return res.status(400).json({ message: "availableQty is required" });

  try {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: "items",
        Key: { id },
        UpdateExpression: "set availableQty = :qty",
        ExpressionAttributeValues: { ":qty": availableQty },
        ReturnValues: "ALL_NEW",
      })
    );

    res.json({ message: "Item updated", updatedItem: result.Attributes });
  } catch (err) {
    console.error("Error updating item:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =======================
// ORDERS ROUTES
// =======================
app.get("/api/orders", async (req, res) => {
  const userEmail = req.query.userEmail;
  if (!userEmail) return res.status(400).json({ message: "userEmail is required" });

  try {
    const result = await ddb.send(
      new ScanCommand({
        TableName: "orders",
        FilterExpression: "userEmail = :email",
        ExpressionAttributeValues: { ":email": userEmail },
      })
    );

    res.json(result.Items || []);
  } catch (err) {
    console.error("Error in /api/orders GET:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/orders", async (req, res) => {
  const { userEmail, items, total } = req.body;
  if (!userEmail || !items)
    return res.status(400).json({ message: "userEmail and items are required" });

  try {
    const newOrder = {
  orderno: Date.now(),
  userEmail,
  items,
  total,
  counterno: Math.floor(Math.random() * 5) + 1,
  tokenno: Math.floor(Math.random() * 1000),
  otp: Math.floor(1000 + Math.random() * 9000),
  expectedDelvtime: new Date(Date.now() + 15 * 60000).toISOString(), // +15min
  createdAt: new Date().toISOString(),
};


    await ddb.send(new PutCommand({ TableName: "orders", Item: newOrder }));
    res.status(201).json({ message: "Order created", order: newOrder });
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ message: "Server error" });
  }
});
// =======================
// GET SINGLE ORDER BY ID
// =======================
app.get("/api/orders/:orderno", async (req, res) => {
  try {
    const orderno = Number(req.params.orderno);
    if (isNaN(orderno)) {
      return res.status(400).json({ message: "Invalid order number" });
    }

    const result = await ddb.send(
      new GetCommand({
        TableName: "orders",
        Key: { orderno }, // must match your DynamoDB primary key
      })
    );

    if (!result.Item) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(result.Item);
  } catch (err) {
    console.error("Error in /api/orders/:orderno:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// =======================
// TRANSACTIONS ROUTE
// =======================
app.post("/api/transactions", verifyToken, async (req, res) => {
  const { orderID, userID, amount } = req.body;
  if (!orderID || !userID || !amount)
    return res.status(400).json({ message: "Missing transaction data" });

  try {
    const newTransaction = {
      transactionID: Date.now().toString(),
      orderID,
      userID,
      amount,
      createdAt: new Date().toISOString(),
    };

    await ddb.send(new PutCommand({ TableName: "transactions", Item: newTransaction }));
    res.status(201).json(newTransaction);
  } catch (err) {
    console.error("Error in /api/transactions:", err);
    res.status(500).json({ message: "Server error" });
  }
});
// =======================
// MANAGER LOGIN
// =======================
app.post("/api/managers/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await ddb.send(
      new GetCommand({ TableName: "managers", Key: { email } })
    );

    const manager = result.Item;
    if (!manager) return res.status(400).json({ message: "Invalid email or password" });

    // If your manager passwords are hashed, use bcrypt.compare
    // If stored as plain text (for testing), use simple comparison:
    const isMatch = manager.passwordhash.startsWith("$2b$")
      ? await bcrypt.compare(password, manager.passwordhash)
      : password === manager.passwordhash;

    if (!isMatch) return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign({ email: manager.email, role: "manager" }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // Update last login
    await ddb.send(
      new UpdateCommand({
        TableName: "managers",
        Key: { email },
        UpdateExpression: "set lastlogin = :t",
        ExpressionAttributeValues: { ":t": new Date().toISOString() },
      })
    );

    res.json({
      message: "Manager login successful",
      token,
      manager: {
        email: manager.email,
        fullname: manager.fullname,
        contactnumber: manager.contactnumber,
      },
    });
  } catch (err) {
    console.error("Error in /api/managers/login:", err);
    res.status(500).json({ message: "Server error" });
  }
});
// POST new item
app.post("/api/items", async (req, res) => {
  try {
    const { id, name, availableQty, imgurl, price } = req.body;

    if (!id || !name)
      return res.status(400).json({ message: "id and name required" });

    const newItem = { id, name, availableQty, imgurl, price };
    await ddb.send(new PutCommand({ TableName: "items", Item: newItem }));
    res.status(201).json(newItem);
  } catch (err) {
    console.error("Error in /api/items POST:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// =======================
// SERVER START
// =======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
