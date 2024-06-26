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
import { ResultReason } from 'microsoft-cognitiveservices-speech-sdk';
import { BiMicrophone } from "react-icons/bi";

const speechsdk = require('microsoft-cognitiveservices-speech-sdk');

export default function Home() {
  const [avatarState, setAvatarState] = useState("waiting");
  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const [visemes, setVisemes] = useState<any>(null);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [response, setResponse] = useState("Marhba bik bda m3aya awjah l9alwa");
  const [displayText, setDisplayText] = useState('INITIALIZED: ready to test speech...');
  const [recording, setRecording] = useState("not yet");
  const { messages, input, handleInputChange, handleSubmit, setInput } =
    useChat({
      api: "/api/guru",
      initialMessages: [
        {
          id: "0",
          role: "system",
          content: `
**Welcome to DespiertaAI**

Your ultimate companion to find internal Serenity.
          `,
        },
      ],
      onResponse: () => {
        setStreaming(false);
        
      },
    });

  async function sttFromMic() {
    const tokenObj = await getTokenOrRefresh();
    await navigator.mediaDevices.getUserMedia({ audio: true });

    const speechConfig = speechsdk.SpeechConfig.fromAuthorizationToken(tokenObj.authToken, tokenObj.region);
    speechConfig.speechRecognitionLanguage = "en-US";

    const audioConfig = speechsdk.AudioConfig.fromDefaultMicrophoneInput();
    const recognizer = new speechsdk.SpeechRecognizer(speechConfig, audioConfig);

    setDisplayText('speak into your microphone... ');
    setAvatarState("listening");
    setRecording("recording");

    recognizer.recognizeOnceAsync((result: { reason: ResultReason; text: any; }) => {
      if (result.reason === ResultReason.RecognizedSpeech) {
        setDisplayText(`You said abro : ${result.text}`);
        setRecording("not yet");
        console.log(result.text);
        setInput(result.text);
        setTimeout(() => {
          formRef.current?.dispatchEvent(
            new Event("submit", {
              cancelable: true,
              bubbles: true,
            })
          );
        }, 1);
      } else {
        setDisplayText('ERROR: Speech was cancelled or could not be recognized. Ensure your microphone is working properly.');
        setRecording("faild");
      }
    });
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
  }, [messages]);

  useEffect(() => {
    const response = messages[messages.length - 1]["content"];
    const role = messages[messages.length - 1]["role"];
    if (role == "assistant") {
      console.log("ya halawti donia");
      console.log(response);
      setResponse(response);
      fetchTTS(response);
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
      handleSubmit(e);
      setStreaming(true);
      setAvatarState("thinking");
    },
    [handleSubmit]
  );

  const fetchTTS = async (text: string) => {
    try {
      const audioRes = await fetch(
        `/api/ttsstt?language=english&text=${text}&type=tts`
      );
      const audio = await audioRes.blob();
      const visemes = JSON.parse(
        (await audioRes.headers.get("visemes")) || "[]"
      );
      const audioUrl = URL.createObjectURL(audio);
      const audioPlayer = new Audio(audioUrl);

      setAudioPlayer(audioPlayer);
      setVisemes(visemes);
      setAvatarState("speaking");
    } catch (error) {
      console.error("Error fetching TTS:", error);
    }
  };

  return (
    <div className="relative max-w-screen-md mx-auto">
      <div className="fixed top-0 inset-x-0 flex justify-between p-4 bg-white shadow-md z-20">
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded"
          onClick={() => setShowChat(true)}
        >
          Chat
        </button>
        <button
          className="px-4 py-2 bg-green-500 text-white rounded"
          onClick={() => setShowChat(false)}
        >
          Real conversation
        </button>
      </div>

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
            <div className="flex justify-center w-full mar h-dvh flex-col items-center pt-20">
              <div className="relative h-4/5 w-full flex items-center justify-center">
                <img
                  src="waiting.png"
                  className={`absolute inset-0 h-full ${avatarState === "waiting" ? "fade-enter fade-enter-active" : "fade-exit fade-exit-active"}`}
                />
                <video
                  src="listening.mp4"
                  playsInline
                  autoPlay
                  loop
                  preload="auto"
                  className={`absolute inset-0 h-full w-full ${avatarState === "listening" ? "fade-enter fade-enter-active" : "fade-exit fade-exit-active"}`}
                />
                <video
                  src="thinking.mp4"
                  playsInline
                  autoPlay
                  loop
                  preload="auto"
                  className={`absolute inset-0 h-full w-full ${avatarState === "thinking" ? "fade-enter fade-enter-active" : "fade-exit fade-exit-active"}`}
                />
                <video
                  src="speaking.mp4"
                  playsInline
                  autoPlay
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
                    hidden
                    style={{ display: 'none' }} // This makes the Form always invisible
                  />
                  <button onClick={() => sttFromMic()}>
                    <span className="flex items-center justify-center bg-black rounded-full p-4">
                      <BiMicrophone className="text-blue-500 text-3xl" />
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
