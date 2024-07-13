"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Message as MessageProps, useChat } from "ai/react";
import Form from "@/components/form";
import Message from "@/components/message";
import cx from "@/utils/cx";
import PoweredBy from "@/components/powered-by";
import MessageLoading from "@/components/message-loading";
import { INITIAL_QUESTIONS } from "@/utils/const";
import ResponseMessage from "@/components/response-message";
import { getTokenOrRefresh } from '../utils/token_util';
import { SpeechRecognizer, SpeechConfig, AudioConfig, ResultReason } from 'microsoft-cognitiveservices-speech-sdk';
import { BiMicrophone } from "react-icons/bi";
import { BsFillStopCircleFill } from "react-icons/bs";
import { useSearchParams } from 'next/navigation'
const speechsdk = require('microsoft-cognitiveservices-speech-sdk');
import { marked } from 'marked';
import he from 'he';

const saveMessages = (messages: any) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('chatMessages', JSON.stringify(messages));
  }
};

const loadMessages = () => {
  if (typeof window !== 'undefined') {

    const messages = localStorage.getItem('chatMessages');
    return messages ? JSON.parse(messages) : [];
  }
};
const handleReset = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('chatMessages');
    window.location.reload(); // This will reload the page to reset the state
  }
};
export default function Home() {
  const [randqst, setRandqst] = useState(Math.floor(Math.random() * 11));
  const searchParams = useSearchParams()
  const search = searchParams.get('name')
  let name: string = ""; // Initialize the variable

  if (search) {
    name = search;
  } else {
    name = "";
  }
  const [language, setLanguage] = useState<string | null>(null);
  const [showLanguageDialog, setShowLanguageDialog] = useState<boolean>(false);

  const [recognizer, setRecognizer] = useState<SpeechRecognizer | null>(null);
  const [avatarState, setAvatarState] = useState("waiting");
  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const [visemes, setVisemes] = useState<any>(null);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [response, setResponse] = useState("Hola, ¿cómo estás? Soy Zen, tu guía personal en Despierta.online, aquí para ayudarte con bienestar y desarrollo personal: Espiritualidad, Cursos y Talleres, Desarrollo Personal, Productos, Esoterismo y Oráculos, y Eventos en Vivo. ¿Cómo puedo asistirte hoy?");
  const [count, setCount] = useState(0)
  const [displayText, setDisplayText] = useState('INITIALIZED: ready to test speech...');
  const [recording, setRecording] = useState("not yet");
  const { messages, input, handleInputChange, handleSubmit, setInput } =
    useChat({
      api: "/api/guru",
      initialMessages: loadMessages()?.length ? loadMessages() : [
        {
          id: "0",
          role: "system",
          content: `
**Welcome to Despierta**

how are you? I'm Zen, your personal guide at Despierta.online. I'm here to guide you on various topics and help you find what you need for your well-being and personal development. How can I assist you today?Here are some options to get started:Spirituality: Learn about spiritual practices and how you can elevate your consciousness.Courses and Workshops: Discover our variety of courses and workshops on well-being, spirituality, and personal development.Personal Development: Find tools and resources to improve different aspects of your life.Products: Explore our products designed to help you on your path to growth and well-being.Esotericism and Oracles: Check out our live tarot sessions and other esoteric services.Live Events: Connect with our upcoming live events and sessions.Select one of the options to dive deeper into the topic that interests you most
          `,
        },
      ],
      onResponse: () => {
        setStreaming(false);
        saveMessages(messages);
      },

    });


  const stopAudioPlayer = () => {
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      setAudioPlayer(null);
      setAvatarState("waiting");
    }
  };

  async function sttFromMic() {
    console.log(language)
    if (recognizer) {

      recognizer.stopContinuousRecognitionAsync(
        () => {
          console.log("Recognition stopped.");
          setRecording("not yet");
          setAvatarState("waiting");
          setRecognizer(null);
          setDisplayText('Audio Recognition stopped');

        },
        (err) => {
          console.error("Error stopping recognition:", err);
        }
      );
      return;
    }

    try {
      const tokenObj = await getTokenOrRefresh();
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const speechConfig = SpeechConfig.fromAuthorizationToken(tokenObj.authToken, tokenObj.region);
      speechConfig.speechRecognitionLanguage = "en-US";

      const audioConfig = AudioConfig.fromDefaultMicrophoneInput();
      const newRecognizer = new SpeechRecognizer(speechConfig, audioConfig);
      setRecognizer(newRecognizer);

      setDisplayText('Speak into your microphone...');
      setAvatarState("listening");
      setRecording("recording");

      newRecognizer.recognizeOnceAsync((result) => {
        if (result.reason === ResultReason.RecognizedSpeech) {
          setDisplayText(`You said: ${result.text}`);
          setRecording("not yet");
          setInput(result.text);
          setTimeout(() => {
            formRef.current?.dispatchEvent(
              new Event("submit", {
                cancelable: true,
                bubbles: true,
              })
            );
          }, 500);
        } else {
          setAvatarState("waiting");
          setRecognizer(null);
          setDisplayText('ERROR: Speech was cancelled or could not be recognized. Ensure your microphone is working properly.');
          setRecording("failed");
        }
      }, (error) => {
        console.error("Error recognizing speech:", error);
        setDisplayText('ERROR: Speech recognition failed.');
        setRecording("failed");
      });
    } catch (error) {
      console.error("Error initializing speech recognizer:", error);
      setDisplayText('ERROR: Initialization failed. Please try again.');
      setRecording("failed");
    }
  }



  const onClickQuestion = (value: string) => {
    setInput(value);
    setTimeout(() => {
      formRef.current?.dispatchEvent(
        new Event("submit", {
          cancelable: true,
          bubbles: true,
        })
      );
    }, 1);
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView();
    }
    saveMessages(messages);
  }, [messages]);


  useEffect(() => {
    const response = messages[messages.length - 1]["content"];
    const role = messages[messages.length - 1]["role"];
    if (role == "assistant") {
      console.log("ya halawti donia");
      console.log(response);
      setResponse(response);
      console.log("Ana kanfetchi awjah xzabbbbbbbbbbbbbbbbbbbbbbb")
      if (!showChat && count > 0) {
        fetchTTS(response);
      }
      console.log("ya ilahi");
    }
    console.log(messages);
  }, [messages]);

  useEffect(() => {
    if (audioPlayer) {
      const handleAudioEnd = () => {
        setAvatarState("waiting"); // Transition back to waiting state
        console.log("Audio playback finished");
      };

      // Attach event listener
      audioPlayer.addEventListener('ended', handleAudioEnd);

      // Start playback
      audioPlayer.play();

      // Clean-up function to remove the event listener
      return () => {
        audioPlayer.removeEventListener('ended', handleAudioEnd);
      };
    }
  }, [audioPlayer]);

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      handleSubmit(e, {
        options: {
          body: {
            additionalData: {
              name: name,
              rand: randqst
            }
          }
        }
      });
      setStreaming(true);
      setCount(count + 1)
      setAvatarState("thinking");
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        setAudioPlayer(null);
      }
    },
    [handleSubmit, input, audioPlayer, language] // add language to the dependency array
  );


  const fetchTTS = async (text: string) => {
    try {
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        setAudioPlayer(null);
      }
      const htmlText = marked(text) as string;
      // Decode HTML entities
      const decodedHtml = he.decode(htmlText);
      // Strip HTML tags to get plain text
      const plainText = decodedHtml.replace(/<[^>]+>/g, '');
      console.log("plain text : " + plainText)
      const audioRes = await fetch(
        `/api/ttsstt?language=english&text=${plainText}&type=tts`
      );
      const audio = await audioRes.blob();
      const visemes = JSON.parse(
        (await audioRes.headers.get("visemes")) || "[]"
      );
      const audioUrl = URL.createObjectURL(audio);
      const audioplayer = new Audio(audioUrl);

      setAudioPlayer(audioplayer);
      setVisemes(visemes);
      setAvatarState("speaking");
    } catch (error) {
      console.error("Error fetching TTS:", error);
    }
  };

  return (
    <div className="relative max-w-screen-md mx-auto">
      {/* <div className="fixed top-0 inset-x-0 flex justify-between p-4 bg-white shadow-md z-20">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => setShowChat(true)}
        >
          Chat
        </button>
        <button
          className="px-4 py-2 bg-red-500 text-white rounded"
          onClick={handleReset}
        >
          New Chat
        </button>
        <button
          className="px-4 py-2 bg-green-500 text-white rounded"
          onClick={() => setShowChat(false)}
        >
          Real conversation
        </button>
      </div> */}

      <style jsx>{`
        .hidden {
          display: none;
        }
        .fade-enter {
          opacity: 0;
        }
        .fade-enter-active {
          opacity: 1;
          transition: opacity 0.5s;
        }
        .fade-exit {
          opacity: 1;
        }
        .fade-exit-active {
          opacity: 0;
          transition: opacity 0.5s;
        }
      `}</style>

      <main className="">
        <div className="w-full">
          {showChat ? (
            <div className="overflow-y-auto relative p-4 md:p-6 flex flex-col min-h-svh !py-32 md:!py-40">
              {messages.map((message: MessageProps) => {
                return <Message key={message.id} {...message} />;
              })}
              {streaming && <MessageLoading />}
              {messages.length === 1 && (
                <div className="mt-4 md:mt-6 grid md:grid-cols-2 gap-2 md:gap-4">
                  {INITIAL_QUESTIONS.map((message) => {
                    return (
                      <button
                        key={message.content}
                        type="button"
                        className="cursor-pointer select-none text-left bg-white font-normal
                      border border-gray-200 rounded-xl p-3 md:px-4 md:py-3
                      hover:bg-zinc-50 hover:border-zinc-400"
                        onClick={() => onClickQuestion(message.content)}
                      >
                        {message.content}
                      </button>
                    );
                  })}
                </div>
              )}
              <div ref={messagesEndRef} />
              <div
                className={cx(
                  "fixed z-10 bottom-0 inset-x-0",
                  "flex justify-center items-center",
                  "bg-white"
                )}
              >
                <span className="absolute bottom-full h-10 inset-x-0 from-white/0 bg-gradient-to-b to-white pointer-events-none" />
                <div className="w-full max-w-screen-md rounded-xl px-4 md:px-5 py-6">
                  <Form
                    ref={formRef}
                    onSubmit={onSubmit}
                    inputProps={{
                      disabled: streaming,
                      value: input,
                      onChange: handleInputChange,
                    }}
                    buttonProps={{
                      disabled: streaming,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center w-full mar h-dvh flex-col items-center !pb-30 md:!pb-16   ">
              <div className="relative h-4/5 w-full flex items-center justify-center">
                <img
                  src="waiting.png"
                  className={`absolute h-full w-auto ${avatarState === "waiting" ? "fade-enter fade-enter-active" : "fade-exit fade-exit-active"}`}
                />
                <video
                  src="listening.mp4"
                  playsInline
                  autoPlay
                  muted
                  loop
                  preload="auto"
                  className={`absolute inset-0 h-full w-full ${avatarState === "listening" ? "fade-enter fade-enter-active" : "fade-exit fade-exit-active"}`}
                />
                <video
                  src="thinking.mp4"
                  playsInline
                  autoPlay
                  muted
                  loop
                  preload="auto"
                  className={`absolute inset-0 h-full w-full ${avatarState === "thinking" ? "fade-enter fade-enter-active" : "fade-exit fade-exit-active"}`}
                />
                <video
                  src="speaking.mp4"
                  playsInline
                  autoPlay
                  muted
                  loop
                  preload="auto"
                  className={`absolute inset-0 h-full w-full ${avatarState === "speaking" ? "fade-enter fade-enter-active" : "fade-exit fade-exit-active"}`}
                />
              </div>
              {avatarState === "waiting" && (
                <ResponseMessage content={response} style={{ height: '60%' }} />
              )}
              {avatarState === "listening" && (
                <ResponseMessage content="Listening ..." style={{ height: '60%' }} />
              )}
              {avatarState === "thinking" && (
                <ResponseMessage content="Generating Your response ..." style={{ height: '60%' }} />
              )}
              {avatarState === "speaking" && (
                <ResponseMessage content={response} style={{ height: '60%' }} />
              )}
              <div
                className={cx(
                  "fixed mt-6 z-10 bottom-0 inset-x-0",
                  "flex flex-col justify-center items-center",
                  "bg-white "
                )}
              >
                {messages.length === 1 && (
                  <div className="flex md:max-w-screen-md max-w-full overflow-x-auto  flex-rows" >
                    {INITIAL_QUESTIONS.map((message) => {
                      return (
                        <button
                          key={message.content}
                          type="button"
                          className="text-xs select-none  bg-white font-normal
                      border border-gray-200 rounded-xl p-3 md:px-4 md:py-1
                      hover:bg-green-50 hover:border-green-400"
                          onClick={() => onClickQuestion(message.content)}
                        >
                          {message.content}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="w-full max-w-screen-md px-4  flex flex-wrap sm:flex-nowrap items-center">

                  <div className="w-full">
                    <Form
                      ref={formRef}
                      onSubmit={onSubmit}
                      inputProps={{
                        disabled: streaming,
                        value: input,
                        onChange: handleInputChange,
                      }}
                      buttonProps={{
                        disabled: streaming,
                      }}
                    />
                  </div>

                  {avatarState === "waiting" && (
                    <div>
                      {language ? (
                        <button onClick={() => sttFromMic()}>
                          <span className="flex items-center justify-center bg-black rounded-full p-4">
                            <BiMicrophone className="text-blue-500 text-3xl" />
                          </span>
                        </button>
                      ) : (
                        <button onClick={() => setShowLanguageDialog(true)}>
                          <span className="flex items-center justify-center bg-black rounded-full p-4">
                            <BiMicrophone className="text-blue-500 text-3xl" />
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                  {avatarState === "listening" && (
                    <button onClick={() => sttFromMic()}><span className="flex items-center justify-center bg-black rounded-full p-4"><BsFillStopCircleFill className="text-blue-500 text-3xl" /></span></button>
                  )}
                  {avatarState === "thinking" && (
                    <>...</>
                  )}
                  {avatarState === "speaking" && (
                    <button onClick={() => stopAudioPlayer()}><span className="flex items-center justify-center bg-black rounded-full p-4"><BsFillStopCircleFill className="text-blue-500 text-3xl" /></span></button>
                  )}
                  <button
                    className="bg-red-500 text-xs text-white rounded"
                    onClick={handleReset}
                  >
                   Empezar de nuevo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {showLanguageDialog && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-gray-800 bg-opacity-75">
            <div className="bg-white rounded-lg p-6 w-1/3">
              <h2 className="mb-4 text-xl font-semibold">Select Language</h2>
              <select
                className="mb-4 px-4 py-2 border rounded w-full"
                onChange={(e) => setLanguage(e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>
                  Select Language
                </option>
                <option value="en-US">English</option>
                <option value="es-ES">Spanish</option>
              </select>
              <div className="flex justify-end">
                <button
                  className="px-4 py-2 bg-blue-500 text-white rounded"
                  onClick={() => setShowLanguageDialog(false)}
                >
                  Set Language
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
