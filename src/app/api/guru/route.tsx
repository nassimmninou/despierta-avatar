import { NextRequest, NextResponse } from "next/server";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { Message as VercelChatMessage, StreamingTextResponse } from "ai";

import { AIMessage, ChatMessage, HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { createRetrieverTool } from "langchain/tools/retriever";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

import { UpstashVectorStore } from "@/app/vectorstore/UpstashVectorStore";
import { UpstashVectorStore2 } from "@/app/vectorstore/UpstashVectorStore2";


export const runtime = "edge";

const redis = Redis.fromEnv();

const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(1, "10 s"),
});

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

export async function POST(req: NextRequest) {
  try {
    const ip = req.ip ?? "127.0.0.1";
    const { success } = await ratelimit.limit(ip);

    if (!success) {
      const textEncoder = new TextEncoder();
      const customString =
        "Oops! It seems you've reached the rate limit. Please try again later.";

      const transformStream = new ReadableStream({
        async start(controller) {
          controller.enqueue(textEncoder.encode(customString));
          controller.close();
        },
      });
      return new StreamingTextResponse(transformStream);
    }

    const body = await req.json();

    /**
     * We represent intermediate steps as system messages for display purposes,
     * but don't want them in the chat history.
     */
    const messages = (body.messages ?? []).filter(
      (message: VercelChatMessage) =>
        message.role === "user" || message.role === "assistant",
    );
    const returnIntermediateSteps = true;
    const previousMessages = messages
      .slice(0, -1)
      .map(convertVercelMessageToLangChainMessage);
    const currentMessageContent = messages[messages.length - 1].content;

    const chatModel = new ChatOpenAI({
      modelName: "gpt-3.5-turbo-1106",
      temperature: 0.2,
      // IMPORTANT: Must "streaming: true" on OpenAI to enable final output streaming below.
      streaming: true,
    });

    /**
     * Create vector store and retriever
     */
    const vectorstore = await new UpstashVectorStore(new OpenAIEmbeddings());
    const vectorstore2 = await new UpstashVectorStore2(new OpenAIEmbeddings());

    const retriever = vectorstore.asRetriever(
      {
        k: 6,
        searchType: "mmr",
        searchKwargs: {
          fetchK: 20,
          lambda: 0.5
        },
        verbose: false
      },
    );
    
    const retriever2 = vectorstore2.asRetriever(
      {
        k: 25,
        searchType: "mmr",
        searchKwargs: {
          fetchK: 25,
          lambda: 0.5
        },
        verbose: false
      },
    );

    /**
     * Wrap the retriever in a tool to present it to the agent in a
     * usable form.
     */
    const tool = createRetrieverTool(retriever, {
      name: "Despierta-General-Knowledge",
      description: "used to search General information to answer general questions about despierta (not recommanding products , music, therapies, services from despierta ...)",
    });
    const tool2 = createRetrieverTool(retriever2, {
      name: "Recommandation-Product-Courses-Therapies-Services",
      description: "Searches for details about products, courses, therapies and services for recommandation and details providing.",
    });

    /**
     * Based on https://smith.langchain.com/hub/hwchase17/openai-functions-agent
     *
     * This default prompt for the OpenAI functions agent has a placeholder
     * where chat messages get inserted as "chat_history".
     *
     * You can customize this prompt yourself!
     */

    const AGENT_SYSTEM_TEMPLATE = `
    You are an AI-powered chatbot called zen designed to help users find the best therapies, courses, and music that suit their personality and needs on Despierta.online in order to find their serenity
    
    Your responses should be precise and factual, with an emphasis on using the context provided and providing links and image from the context whenever posible.
    
    Don't repeat yourself in your responses even if some information is repeated in the context.

    In order to keep the conversation interactive , don't hesitate to ask questions about user's interests if needed ,
    
    first, Request for Information: 
    -birth date , and place of birth then 
    -multiple-choice questions one by one (not all the questions at once)

   What animal best represents you?
     -  Eagle
     -  Dolphin
     -  Lion
     -  Bear
   - What activity do you prefer to relax?
     -  Meditate in silence
     -  Listen to music
     -  Walk outdoors
     -  Read a book
   - Where do you feel most at peace?
     -  At the beach
     -  In the mountains
     -  In the forest
     -  At home
   - What type of character attracts you most in a story?
     -  The hero
     -  The wise one
     -  The rebel
     -  The villain
   - What type of movies do you prefer?
     -  Comedies
     -  Dramas
     -  Thrillers
     -  Documentaries
    once these questions are answered from the options give :

    Analyze their responses to understand their personality traits and preferences.

  - provide a neuromological analysis, astrological sign

   - Recommend specific products , music tracks, courses, and therapies available on the website and justify why the user needs them based on their character


    In addition to providing personalized recommendations, you can discuss some topics .

    Topics you can discuss :

    -Personal Development: Cover topics like self-awareness, overcoming personal limitations, and skill development.

    -Meditation and Mindfulness:Discuss different meditation techniques, the benefits of regular practice, and tips for beginners.

    -Courses and Workshops: Detail the various courses available, what to expect from them, and how they can aid in the journey towards enlightenment and consciousness awakening.

    -Alternative Therapies:Explore the different therapies offered on the platform, such as sound therapy, reiki, or aromatherapy, and their specific benefits.

    -Enlightenment and Spiritual Awakening: " Discuss key concepts about what achieving enlightenment entails and how the platform can assist in this spiritual journey.
    
    -Support and Help: Offer assistance on how to navigate the platform, resolve technical issues, and make the most of the services offered.
    
    -Analyze user's numerology based on his birth date

    Guidelines :

    -your actual goal is to generate sales, talk in a conviction manner

    -virtuous answer always

    -never ask user vague question such as "how can i assist you / feel free to ask", but try to conduct the conversation towards your capabilities and your goal with specific options for the user

    -Reply with apologies and tell the user that you don't know the answer only when you are faced with a question whose answer is not available in the context.
    
    `;

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", AGENT_SYSTEM_TEMPLATE],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]);

    const agent = await createOpenAIFunctionsAgent({
      llm: chatModel,
      tools: [tool,tool2],
      prompt,
    });

    const agentExecutor = new AgentExecutor({
      agent,
      tools: [tool,tool2],
      // Set this if you want to receive all intermediate steps in the output of .invoke().
      returnIntermediateSteps,
    });

    if (!returnIntermediateSteps) {
      const logStream = await agentExecutor.streamLog({
        input: currentMessageContent,
        chat_history: previousMessages,
      });

      const textEncoder = new TextEncoder();
      const transformStream = new ReadableStream({
        async start(controller) {
          for await (const chunk of logStream) {
            if (chunk.ops?.length > 0 && chunk.ops[0].op === "add") {
              const addOp = chunk.ops[0];
              if (
                addOp.path.startsWith("/logs/ChatOpenAI") &&
                typeof addOp.value === "string" &&
                addOp.value.length
              ) {
                controller.enqueue(textEncoder.encode(addOp.value));
              }
            }
          }
          controller.close();
        },
      });

      return new StreamingTextResponse(transformStream);
    } else {
      /**
       * Intermediate steps are the default outputs with the executor's `.stream()` method.
       * We could also pick them out from `streamLog` chunks.
       * They are generated as JSON objects, so streaming them is a bit more complicated.
       */
      console.log("iam here")

      const result = await agentExecutor.invoke({
        input: currentMessageContent,
        chat_history: previousMessages,
      });
      console.log(result)
      let urls;
      try {
        urls = JSON.parse(
          `[${result.intermediateSteps[0]?.observation.replaceAll("}\n\n{", "}, {")}]`,
        ).map((source: { url: any }) => source.url);
      } catch (error) {
        console.error("Error parsing JSON or mapping URLs:", error);
        urls = []; // Initialize urls as an empty array in case of an error
      }
      return new NextResponse(result.output);

      return NextResponse.json(
        {
          _no_streaming_response_: true,
          output: result.output,
          sources: urls,
        },
        { status: 200 },
      );
    }
  } catch (e: any) {
    console.log(e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
