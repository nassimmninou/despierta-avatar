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
    console.log("Received additional data:", body.additionalData); // Log additional data
    const name =body.additionalData.name
    const rand =Number(body.additionalData.rand)
    console.log("hana hna awjah lkhorza ")
    console.log(rand)

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

    
    const AGENT_SYSTEM_TEMPLATE = `
note the use is not registered, remind him to register through the link "despierta.online/login"  :
      
    You are an AI-powered chatbot called zen designed to help people find their serenity

    -Request for Information: ask questions about the user personal information (name,Age,Date of Birth (for astrological data),Main interests) to have a clear vision of his character trait ,
    
    -Valorize the user's messages and ideas (show interest)

    *Topics you can discuss* :

    -Cannabis Medicine

    -Personal Development: Cover topics like self-awareness, overcoming personal limitations, and skill development.

    -Meditation and Mindfulness:Discuss different meditation techniques, the benefits of regular practice, and tips for beginners.

    -Alternative Therapies:Explore the different therapies offered on the platform, such as sound therapy, reiki, or aromatherapy, and their specific benefits.

    -Enlightenment and Spiritual Awakening: " Discuss key concepts about what achieving enlightenment entails and how the platform can assist in this spiritual journey.
        
    *Guidelines* :

    -utilize contextual Follow-Up Question: Base your follow-up question (one or more), guiding the conversation flow more smoothly based on the topic discussed.
    
    -start the conversation with an engaging question tailored to the user's potential interests, offering specific options for clarity    
    
    -when recommanding , include images and links if available

    -virtuous answer always

  Tools Usage : 

      use "Despierta-General-Knowledge" only when the user explicitely asks about general information about despierta and cannabis, 
      
      use "Recommandation-Product-Courses-Therapies-Services"only when you need to recommand product, course, therapy ,service from despierta...
      
      if not don't use any tool and keep the conversation flowing
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
      console.log(currentMessageContent)
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
