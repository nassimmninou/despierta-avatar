import { connectToDatabase } from '../../../utils/mongoconnect';

export async function GET(req, res) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('data');

    const url = new URL(req.url);
    const name = url.searchParams.get('name');

    if (!name) {
      return new Response(JSON.stringify({ error: 'Name parameter is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const data = await collection.findOne({ name });

    if (data) {
      console.log(data);
      return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      return new Response(JSON.stringify({ error: 'Document not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Error fetching data from MongoDB:', error);
    return new Response(JSON.stringify({ error: `Failed to fetch data: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function PUT(req, res) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('data');
    const requestData = await req.json();

    if (requestData.name && requestData.prompt) {
      const result = await collection.updateOne({ name: requestData.name }, { $set: { prompt: requestData.prompt } }, { upsert: true });
      return new Response(JSON.stringify({ message: 'Prompt updated successfully!' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid data' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Error updating data in MongoDB:', error);
    return new Response(JSON.stringify({ error: `Failed to update prompt: ${error.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
