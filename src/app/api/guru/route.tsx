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

    /**
     * Based on https://smith.langchain.com/hub/hwchase17/openai-functions-agent
     *
     * This default prompt for the OpenAI functions agent has a placeholder
     * where chat messages get inserted as "chat_history".
     *
     * You can customize this prompt yourself!
     */

    const qa = [
      `What animal best represents you?
       - Eagle
       - Dolphin
       - Lion
       - Bear
     - What activity do you prefer to relax?
       - Meditate in silence
       - Listen to music
       - Walk outdoors
       - Read a book
     - Where do you feel most at peace?
       - At the beach
       - In the mountains
       - In the forest
       - At home
     - What type of character attracts you most in a story?
       - The hero
       - The wise one
       - The rebel
       - The villain
     - What type of movies do you prefer?
       - Comedies
       - Dramas
       - Thrillers
       - Documentaries`,
      
      `What element best represents your personality?
       - Fire
       - Water
       - Earth
       - Air
     - What time of day do you feel most energized?
       - Morning
       - Afternoon
       - Evening
       - Night
     - What is your favorite type of weather?
       - Sunny and warm
       - Rainy and cool
       - Snowy and cold
       - Windy and mild
     - How do you handle stress?
       - By talking to someone
       - By exercising
       - By doing a hobby
       - By resting
     - Which season do you prefer?
       - Spring
       - Summer
       - Autumn
       - Winter`,
      
      `What role do you typically take in a group project?
       - Leader
       - Organizer
       - Innovator
       - Supporter
     - What type of books do you enjoy reading the most?
       - Fiction
       - Non-fiction
       - Science fiction
       - Biographies
     - What kind of art appeals to you the most?
       - Abstract
       - Realism
       - Surrealism
       - Impressionism
     - How do you prefer to spend your weekends?
       - Socializing with friends
       - Engaging in a hobby
       - Relaxing at home
       - Exploring new places
     - What type of vacation do you prefer?
       - Beach holiday
       - Adventure trip
       - Cultural tour
       - Staycation`,
      
      `Which of these animals do you relate to the most?
       - Owl
       - Dog
       - Cat
       - Horse
     - How do you typically solve problems?
       - Analyzing logically
       - Seeking advice
       - Trusting intuition
       - Researching thoroughly
     - What is your preferred social setting?
       - Large parties
       - Small gatherings
       - One-on-one conversations
       - Solitude
     - Which of these hobbies sounds most appealing to you?
       - Painting or drawing
       - Playing sports
       - Cooking or baking
       - Writing or journaling
     - What is your favorite type of music?
       - Pop
       - Classical
       - Rock
       - Jazz`,
      
      `What kind of learner are you?
       - Visual
       - Auditory
       - Kinesthetic
       - Reading/Writing
     - How do you approach new challenges?
       - With enthusiasm
       - With caution
       - With skepticism
       - With curiosity
     - Which quality do you value most in others?
       - Honesty
       - Compassion
       - Intelligence
       - Humor
     - What is your favorite way to express creativity?
       - Through art
       - Through writing
       - Through music
       - Through dance
     - What is your preferred type of exercise?
       - Running or jogging
       - Yoga or pilates
       - Team sports
       - Weightlifting`,
      
      `How do you prefer to communicate?
       - Face-to-face
       - Over the phone
       - Via text message
       - Through email
     - What type of cuisine do you enjoy the most?
       - Italian
       - Mexican
       - Japanese
       - Indian
     - Which of these values is most important to you?
       - Freedom
       - Justice
       - Equality
       - Tradition
     - What is your favorite way to spend a rainy day?
       - Watching movies
       - Reading a book
       - Cooking or baking
       - Sleeping in
     - What motivates you the most?
       - Achieving goals
       - Helping others
       - Learning new things
       - Being recognized`,
      
      `What kind of environments do you thrive in?
       - Structured and orderly
       - Flexible and adaptable
       - Fast-paced and dynamic
       - Calm and steady
     - What is your favorite way to unwind after a long day?
       - Taking a bath
       - Watching TV
       - Talking to a friend
       - Going for a walk
     - Which of these traits best describes you?
       - Adventurous
       - Analytical
       - Empathetic
       - Creative
     - What kind of TV shows do you prefer?
       - Sitcoms
       - Crime dramas
       - Reality shows
       - Sci-fi series
     - What is your ideal work environment?
       - Collaborative
       - Independent
       - Fast-paced
       - Relaxed`,
      
      `What do you value most in friendships?
       - Loyalty
       - Trust
       - Fun
       - Support
     - What kind of home decor do you prefer?
       - Modern
       - Rustic
       - Minimalist
       - Eclectic
     - How do you prefer to spend your free time?
       - Exploring the outdoors
       - Creating something new
       - Learning new skills
       - Spending time with loved ones
     - Which historical period fascinates you the most?
       - Ancient civilizations
       - Medieval times
       - Renaissance
       - Modern era
     - What is your favorite way to stay active?
       - Hiking
       - Dancing
       - Swimming
       - Biking`,
      
      `What is your preferred way of traveling?
       - By plane
       - By car
       - By train
       - By boat
     - How do you handle conflicts?
       - Confronting them directly
       - Avoiding them
       - Seeking mediation
       - Compromising
     - What kind of movies do you avoid?
       - Horror
       - Musicals
       - Rom-coms
       - War films
     - What kind of dreams do you remember most often?
       - Adventures
       - Nightmares
       - Fantasies
       - Mundane events
     - What type of art do you enjoy creating?
       - Sculptures
       - Paintings
       - Digital art
       - Crafts`,
      
      `What is your favorite way to start the day?
       - With a workout
       - With a good breakfast
       - With meditation
       - With reading the news
     - What kind of clothing do you prefer?
       - Casual
       - Formal
       - Sporty
       - Bohemian
     - What is your favorite holiday?
       - Christmas
       - Halloween
       - Thanksgiving
       - New Year's
     - How do you prefer to spend your lunch break?
       - Socializing with colleagues
       - Going for a walk
       - Eating alone
       - Running errands
     - What is your ideal way to celebrate a special occasion?
       - Hosting a party
       - Going out to a fancy dinner
       - Taking a trip
       - Spending it quietly with close friends or family`,
      
      `What kind of pet do you prefer?
       - Dog
       - Cat
       - Bird
       - Fish
     - How do you prefer to stay informed?
       - Reading newspapers
       - Watching TV news
       - Listening to podcasts
       - Following online news sources
     - What is your favorite type of dessert?
       - Ice cream
       - Cake
       - Cookies
       - Pie
     - What is your approach to new technology?
       - Early adopter
       - Cautious user
       - Skeptical
       - Indifferent
     - What kind of volunteer work interests you most?
       - Environmental conservation
       - Animal rescue
       - Community service
       - Educational programs`
    ];
    
    const AGENT_SYSTEM_TEMPLATE = `
    -note that the user is called ${name} (registred user), you can call the user's by name,
    ${name === 'Unregistered' ? 'note the use is not registered, remind him to register through the link "despierta.online/login" ' :
      
    'note that the user is called '+name+ '(registred user), you can call the user by name,'}
    -note that user doesn't have knowledge and lost you are the guide inside despierta.online

    You are an AI-powered chatbot called zen designed to help users find the best therapies, courses, and music that suit their personality and needs on Despierta.online in order to find their serenity

    keep the conversation interactive, and guide it with confidence (don't ask vague questions to user such as how can i assist you) ,
    
  1)step first, Request for Information: 
    -birth date , and place of birth then 
    -multiple-choice questions one by one (not all the questions at once)

    ${qa[rand]}

  2)once these questions are answered from the options Analyze  responses to understand the personality traits and preferences and provide a neuromological analysis, astrological sign

  3)After the analysis Ask for additional information such as mood...
  
  4)Recommend specific products , music tracks, courses, and therapies available on the website and justify why the user needs them based on their character

  5)keep the conversation smooth by discussing some topics .

    Topics you can discuss :

    -Personal Development: Cover topics like self-awareness, overcoming personal limitations, and skill development.

    -Meditation and Mindfulness:Discuss different meditation techniques, the benefits of regular practice, and tips for beginners.

    -Courses and Workshops: Detail the various courses available, what to expect from them, and how they can aid in the journey towards enlightenment and consciousness awakening.

    -Alternative Therapies:Explore the different therapies offered on the platform, such as sound therapy, reiki, or aromatherapy, and their specific benefits.

    -Enlightenment and Spiritual Awakening: " Discuss key concepts about what achieving enlightenment entails and how the platform can assist in this spiritual journey.
    
    -Support and Help: Offer assistance on how to navigate the platform, resolve technical issues, and make the most of the services offered.
    
    -Analyze user's numerology based on his birth date

    Guidelines :
    
    -when recommanding , include images and links if available

    -your actual goal is to generate sales, talk in a conviction manner

    -virtuous answer always

    -never ask user vague question such as "how can i assist you / feel free to ask", but try to conduct the conversation towards your capabilities and your goal with specific questions options for the user like "what do you think of <some topic you can discuss>/ are you ready to <some topic you can discuss ...>.."

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
