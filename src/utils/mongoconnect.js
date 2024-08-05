import { MongoClient } from 'mongodb';
const uri = process.env["MONGODB_URI"]
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
export async function connectToDatabase() {
  await client.connect();
  const db = client.db("settings");
  return { db, client };
}
