const express = require('express')
const dotenv = require('dotenv')
const cors = require("cors");
// Added ObjectId here to handle database lookups by ID
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
dotenv.config();

const uri = process.env.MONGODB_URI;

const app = express()
const PORT = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();

        const db = client.db("ideavault")
        const ideaCollection = db.collection("ideas")

        //  SUBMIT A NEW IDEA
        app.post('/idea', async (req, res) => {
            const ideaData = req.body
            console.log(ideaData);
            
            // Ensure default values are set for new submissions
            if (ideaData.upvotes === undefined) ideaData.upvotes = 0;
            if (ideaData.comments === undefined) ideaData.comments = [];

            const result = await ideaCollection.insertOne(ideaData)
            res.json(result)
        })

        // 2. GET ALL IDEAS (Used on Home Page)
        app.get("/idea", async (req, res) => {
            const result = await ideaCollection.find().toArray();
            res.json(result);
        });

        // 3. GET SINGLE IDEA BY ID (Used on Details Page)
        app.get("/idea/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) };
                const result = await ideaCollection.findOne(query);
                if (!result) {
                    return res.status(404).json({ error: "Idea not found" });
                }
                res.json(result);
            } catch (err) {
                res.status(500).json({ error: "Failed to fetch idea details", details: err.message });
            }
        });

        // 4. PATCH UPVOTE (Atomic Increment)
        app.patch("/idea/:id/upvote", async (req, res) => {
            try {
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) };
                
                // Atomically increment upvote count
                await ideaCollection.updateOne(filter, { $inc: { upvotes: 1 } });
                const updatedIdea = await ideaCollection.findOne(filter);
                res.json(updatedIdea);
            } catch (err) {
                res.status(500).json({ error: "Failed to process upvote", details: err.message });
            }
        });

        // 5. POST COMMENT (Append Constructive Suggestion)
        app.post("/idea/:id/comment", async (req, res) => {
            try {
                const id = req.params.id;
                const { username, text } = req.body;

                if (!username || !text) {
                    return res.status(400).json({ error: "Username and feedback are required" });
                }

                const filter = { _id: new ObjectId(id) };
                const newComment = {
                    username,
                    text,
                    createdAt: new Date()
                };

                // Push new comment object into comments array
                await ideaCollection.updateOne(filter, { $push: { comments: newComment } });
                const updatedIdea = await ideaCollection.findOne(filter);
                res.json(updatedIdea);
            } catch (err) {
                res.status(500).json({ error: "Failed to post comment", details: err.message });
            }
        });

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(PORT, () => {
    console.log(`Running on port ${PORT}`)
})
