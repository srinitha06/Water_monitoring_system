const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const axios = require("axios");

dotenv.config();
const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "https://water-monitoring-system-frontend-bb.vercel.app","https://water-monitoring-system-frontend-ez.vercel.app/"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log(" MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
});

const User = mongoose.model("User", userSchema);


const dispenserSchema = new mongoose.Schema({
  location: { type: String, required: true },
  status: { type: String, enum: ["Active", "Maintenance"], default: "Active" },
  createdAt: { type: Date, default: Date.now },
});

const Dispenser = mongoose.model("Dispenser", dispenserSchema);


app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser)
    return res.status(400).json({ message: "User already exists" });

  const newUser = new User({ username, email, password });

  try {
    await newUser.save();

//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: "Welcome to Water Dispenser System",
//       text: `Hello ${username},

// Thank you for signing up for the Water Dispenser Monitoring System.
// You can now log in and manage your dispensers.

// Best regards,
// Water Dispenser Monitoring Team`,
//     };

//     await transporter.sendMail(mailOptions);
    res
      .status(201)
      .json({ message: "User registered successfully, welcome email sent" });
  } catch (err) {
    res.status(500).json({ message: "Error registering user", error: err });
  }
});




app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });
    if (user.password !== password)
      return res.status(401).json({ message: "Invalid password" });

//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: "Login Successful - Water Dispenser System",
//       text: `Hello ${user.username},

// You have successfully logged in to the Water Dispenser Monitoring System at ${new Date().toLocaleString()}.

// If this wasn’t you, please secure your account immediately.

// Best regards,
// Water Dispenser Monitoring Team`,
//     };

//     await transporter.sendMail(mailOptions);
    res
      .status(200)
      .json({ message: "Login successful, email notification sent" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});


const THINGSPEAK_CHANNEL_ID = "3129473"; 
const THINGSPEAK_READ_API_KEY = "PACOABSY0TLV6NDY"; 

app.get("/api/thingspeak", async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?api_key=${THINGSPEAK_READ_API_KEY}&results=1`
    );

    const feed = response.data.feeds[0];

    const sensorData = {
      flowRate: parseFloat(feed.field1) || 0,
      tankStatus: feed.field2 === "0" ? "LOW" : "FULL",
      rainStatus: feed.field3 === "1" ? "Rain Detected" : "No Rain",
      relayState: feed.field4 === "1" ? "ON" : "OFF",
      timestamp: feed.created_at,
    };

    res.status(200).json(sensorData);
  } catch (error) {
    console.error("Error fetching ThingSpeak data:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch ThingSpeak data", error: error.message });
  }
});


app.post("/api/dispensers", async (req, res) => {
  try {
    const { location, status } = req.body;
    const newDispenser = new Dispenser({ location, status });
    await newDispenser.save();

    const alertMailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.ALERT_RECEIVER || process.env.EMAIL_USER,
      subject: ` New Dispenser Added - ${location}`,
      text: `A new dispenser has been added to the system.\n\nDetails:\nLocation: ${location}\nStatus: ${status}\nDate: ${new Date().toLocaleString()}\n\nPlease verify its condition or maintenance schedule.`,
    };

    try {
      await transporter.sendMail(alertMailOptions);
      console.log("Alert email sent successfully for new dispenser.");
    } catch (emailError) {
      console.error(" Error sending alert email:", emailError);
    }

    res.status(201).json({
      message: " Dispenser added and alert email sent",
      dispenser: newDispenser,
    });
  } catch (error) {
    console.error("Error adding dispenser:", error);
    res.status(500).json({ message: "Error adding dispenser", error });
  }
});

app.get("/api/dispensers", async (req, res) => {
  try {
    const dispensers = await Dispenser.find();
    res.status(200).json(dispensers);
  } catch (error) {
    res.status(500).json({ message: "Error fetching dispensers", error });
  }
});


app.delete("/api/dispensers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Dispenser.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Dispenser not found" });
    }

    res.json({ message: "🗑️ Dispenser deleted successfully" });
  } catch (error) {
    console.error("Error deleting dispenser:", error);
    res.status(500).json({ message: "Server error" });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));
