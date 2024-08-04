import { promises as fs } from 'fs';
import path from 'path';

export async function GET(req, res) {
  const filePath = path.join(process.cwd(), 'data.json');
  const jsonData = await fs.readFile(filePath, 'utf8');
  const data = JSON.parse(jsonData);
  console.log(data);
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function PUT(req, res) {
  const filePath = path.join(process.cwd(), 'data.json');
  const jsonData = await fs.readFile(filePath, 'utf8');
  let data = JSON.parse(jsonData);
  
  try {
    const requestData = await req.json();
    if (requestData.prompt) {
      data.prompt = requestData.prompt;
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return new Response(JSON.stringify({ message: 'Prompt updated successfully!' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid data' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Error updating prompt:', error);
    return new Response(JSON.stringify({ error: 'Failed to update prompt' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
