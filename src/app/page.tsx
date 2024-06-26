"use client"
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Message as MessageProps, useChat } from "ai/react";
import Form from "@/components/form";
import Message from "@/components/message";
import cx from "@/utils/cx";
import PoweredBy from "@/components/powered-by";
import MessageLoading from "@/components/message-loading";
import { INITIAL_QUESTIONS } from "@/utils/const";
import ResponseMessage from "@/components/response-message";

export default function Home() {
  const formRef = useRef<HTMLFormElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [streaming, setStreaming] = useState<boolean>(false);
  const [audioPlayer, setAudioPlayer] = useState<HTMLAudioElement | null>(null);
  const [visemes, setVisemes] = useState<any>(null);
  const [showChat, setShowChat] = useState<boolean>(false);
  const [response, setResponse] = useState("");

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
      // fetchTTS(response);
      console.log("ya ilahi");
    }
    console.log(messages);
  }, [messages]);

  useEffect(() => {
    audioPlayer?.play();
    setStreaming(false);
  }, [audioPlayer]);

  const onSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      handleSubmit(e);
      setStreaming(true);
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

      {/* Spacer div to ensure content doesn't go under fixed buttons */}

      {/* Scrollable chat area  relative p-4 md:p-6 flex overflow-y-auto min-h-svh !pb-32 md:!pb-40 */}
      <main className=" ">
        <div className="w-full">
          {showChat ? (
            <div className=" overflow-y-auto  relative p-4 md:p-6   flex flex-col min-h-svh !py-32 md:!py-40 ">
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

              {/* bottom ref */}
              <div ref={messagesEndRef} />
              <div
        className={cx(
          "fixed z-10 bottom-0 inset-x-0",
          "flex justify-center items-center",
          "bg-white"
        )}
      >
        <span
          className="absolute bottom-full h-10 inset-x-0 from-white/0
         bg-gradient-to-b to-white pointer-events-none"
        />

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
            <video src="speaking.mp4"  playsInline  autoPlay loop className="h-4/5"></video> {/* 40% height */}
            <ResponseMessage content={response} style={{ height: '60%' }} /> {/* 60% height */}
        </div>

          )}
        </div>
      </main>

      {/* Fixed input form */}

    </div>
  );
}
