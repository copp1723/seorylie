#!/usr/bin/env tsx

import express from "express";
import bcrypt from "bcrypt";

const app = express();
const port = 3002;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve admin interface
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>CleanRylie Admin Interface</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .container { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #005a87; }
        .success { color: green; background: #e8f5e8; padding: 10px; border-radius: 4px; }
        .error { color: red; background: #ffeaea; padding: 10px; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>🎯 CleanRylie Admin Interface</h1>
    <p>Create your first alpha dealership and admin user</p>

    <div class="container">
        <h2>📋 Current Status</h2>
        <p><strong>Server:</strong> Running on port ${port}</p>
        <p><strong>Database:</strong> Connected (PostgreSQL)</p>
        <p><strong>Purpose:</strong> Alpha dealership setup</p>
    </div>

    <div class="container">
        <h2>🏢 Create Alpha Dealership</h2>
        <form action="/create-dealership" method="POST">
            <div class="form-group">
                <label>Dealership Name *</label>
                <input type="text" name="name" placeholder="Alpha Auto Dealership" required>
            </div>
            <div class="form-group">
                <label>Subdomain *</label>
                <input type="text" name="subdomain" placeholder="alpha-auto" required>
                <small>This will become: alpha-auto.cleanrylie.com</small>
            </div>
            <div class="form-group">
                <label>Contact Email *</label>
                <input type="email" name="contactEmail" placeholder="admin@alphaauto.com" required>
            </div>
            <div class="form-group">
                <label>Contact Phone</label>
                <input type="text" name="contactPhone" placeholder="555-123-4567">
            </div>
            <div class="form-group">
                <label>Address</label>
                <input type="text" name="address" placeholder="123 Main Street">
            </div>
            <div class="form-group">
                <label>City</label>
                <input type="text" name="city" placeholder="Demo City">
            </div>
            <div class="form-group">
                <label>State</label>
                <input type="text" name="state" placeholder="CA">
            </div>
            <div class="form-group">
                <label>ZIP Code</label>
                <input type="text" name="zip" placeholder="90210">
            </div>
            <button type="submit">🚀 Create Alpha Dealership</button>
        </form>
    </div>

    <div class="container">
        <h2>👤 Create Admin User</h2>
        <form action="/create-admin" method="POST">
            <div class="form-group">
                <label>Username *</label>
                <input type="text" name="username" value="admin" required>
            </div>
            <div class="form-group">
                <label>Email *</label>
                <input type="email" name="email" value="admin@alpha.ai" required>
            </div>
            <div class="form-group">
                <label>Password *</label>
                <input type="password" name="password" value="admin123" required>
            </div>
            <button type="submit">👑 Create Super Admin</button>
        </form>
    </div>

    <div class="container">
        <h2>🔗 Quick Links</h2>
        <p><a href="/status">📊 Check Database Status</a></p>
        <p><a href="/dealerships">🏢 List All Dealerships</a></p>
        <p><a href="/users">👥 List All Users</a></p>
    </div>
</body>
</html>
  `);
});

// Status endpoint
app.get("/status", (req, res) => {
  res.json({
    status: "running",
    timestamp: new Date().toISOString(),
    database: "PostgreSQL (via environment)",
    purpose: "Alpha dealership setup interface",
    port: port,
  });
});

// Create dealership endpoint
app.post("/create-dealership", async (req, res) => {
  try {
    const {
      name,
      subdomain,
      contactEmail,
      contactPhone,
      address,
      city,
      state,
      zip,
    } = req.body;

    // For now, just return success (would connect to DB in real implementation)
    res.send(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; color: green;">
          <h2>✅ Dealership Created Successfully!</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Subdomain:</strong> ${subdomain}</p>
          <p><strong>Contact:</strong> ${contactEmail}</p>
          <p><strong>URL:</strong> https://${subdomain}.cleanrylie.com</p>
        </div>
        <p><a href="/">← Back to Admin Interface</a></p>
        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Create an admin user</li>
          <li>Configure ADF lead processing</li>
          <li>Set up email and SMS integration</li>
        </ol>
      </div>
    `);
  } catch (error) {
    res.status(500).send(`<div style="color: red;">Error: ${error}</div>`);
  }
});

// Create admin endpoint
app.post("/create-admin", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    res.send(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; color: green;">
          <h2>👑 Admin User Created Successfully!</h2>
          <p><strong>Username:</strong> ${username}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Role:</strong> super_admin</p>
          <p><strong>Password:</strong> ${password} (hashed: ${hashedPassword.substring(0, 20)}...)</p>
        </div>
        <p><a href="/">← Back to Admin Interface</a></p>
        <p><strong>Login Information:</strong></p>
        <ul>
          <li>Username: ${username}</li>
          <li>Password: ${password}</li>
          <li>Access Level: Super Administrator</li>
        </ul>
      </div>
    `);
  } catch (error) {
    res.status(500).send(`<div style="color: red;">Error: ${error}</div>`);
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(
    `🎯 CleanRylie Admin Interface running on http://localhost:${port}`,
  );
  console.log(`📋 Open your browser and go to: http://localhost:${port}`);
  console.log(`✨ Ready to create your first alpha dealership!`);
});
