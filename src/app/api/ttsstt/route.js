import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { PassThrough } from "stream";
import axios from 'axios';


export async function GET(req) {
 if (req.nextUrl.searchParams.get("type")=="stt"){

  const { SPEECH_KEY, SPEECH_REGION } = process.env;
  const headers = {
      'Ocp-Apim-Subscription-Key': SPEECH_KEY,
      'Content-Type': 'application/x-www-form-urlencoded'
  };
  try {
      const tokenResponse = await axios.post(`https://${SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, null, { headers });
      return Response.json({ token: tokenResponse.data, region: SPEECH_REGION }, { status: 200 })
  } catch (err) {
      return Response.json({ error: 'There was an error authorizing your speech key.' }, { status: 401 })
  }


 }
 else if (req.nextUrl.searchParams.get("type")=="tts"){
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env["SPEECH_KEY"],
    process.env["SPEECH_REGION"]
  );
  speechConfig.speechSynthesisVoiceName = "en-US-JennyMultilingualNeural";

  const speechSynthesizer = new sdk.SpeechSynthesizer(speechConfig);
  const visemes = [];
  let bufferStream; 
  speechSynthesizer.visemeReceived = function (s, e) {
    visemes.push([e.audioOffset / 10000, e.visemeId]);
  };
  const audioStream = await new Promise((resolve, reject) => {
    speechSynthesizer.speakTextAsync(
      req.nextUrl.searchParams.get("text") ||
        "I'm excited to try text to speech",
      (result) => {
        const { privAudioData } = result;
        speechSynthesizer.close();
        bufferStream = new PassThrough();
        bufferStream.end(Buffer.from(privAudioData));
        resolve(bufferStream);
      },
      (error) => {
        speechSynthesizer.close();
        reject(error);
      }
    );
  });
  const response = new Response(bufferStream, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `inline; filename=tts.mp3`,
      Visemes: JSON.stringify(visemes),
    },
  });
  return response;
}
 }
  
