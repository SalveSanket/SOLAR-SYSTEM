const path = require('path');
require('dotenv').config();
const fs = require('fs');
const express = require('express');
const OS = require('os');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const serverless = require('serverless-http');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '/')));
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
    user: process.env.MONGO_USERNAME,
    pass: process.env.MONGO_PASSWORD,
})
.then(() => {
    console.log('✅ MongoDB Connected');
    // Only run local server outside of Lambda
    if (!process.env.LAMBDA_TASK_ROOT) {
        app.listen(3000, '0.0.0.0', () => {
            console.log("🚀 Server running on port 3000");
        });
    }
})
.catch((err) => {
    console.error("❌ MongoDB connection error:", err);
});

// Schema and model
const dataSchema = new mongoose.Schema({
    name: String,
    id: Number,
    description: String,
    image: String,
    velocity: String,
    distance: String
});
const planetModel = mongoose.model('planets', dataSchema);

// API
app.post('/planet', async (req, res) => {
    try {
        const planetData = await planetModel.findOne({ id: req.body.id });
        if (!planetData) {
            return res.status(404).send({ message: "Planet not found" });
        }
        res.send(planetData);
    } catch (err) {
        console.error("Error fetching planet data:", err);
        res.status(500).send({ error: "Internal Server Error" });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/', 'index.html'));
});

app.get('/api-docs', (req, res) => {
    fs.readFile('oas.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            res.status(500).send('Error reading file');
        } else {
            res.json(JSON.parse(data));
        }
    });
});

// Health Checks
app.get('/os', (req, res) => {
    res.json({ os: OS.hostname(), env: process.env.NODE_ENV });
});
app.get('/live', (req, res) => res.json({ status: 'live' }));
app.get('/ready', (req, res) => res.json({ status: 'ready' }));

module.exports = app;
module.exports.handler = serverless(app);