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
      1) Eagle
      2) Dolphin
      3) Lion
      4) Bear
      What activity do you prefer to relax?
      1) Meditate in silence
      2) Listen to music
      3) Walk outdoors
      4) Read a book
      Where do you feel most at peace?
      1) At the beach
      2) In the mountains
      3) In the forest
      4) At home
      What type of character attracts you most in a story?
      1) The hero
      2) The wise one
      3) The rebel
      4) The villain
      What type of movies do you prefer?
      1) Comedies
      2) Dramas
      3) Thrillers
      4) Documentaries`,
      
      `What element best represents your personality?
      1) Fire
      2) Water
      3) Earth
      4) Air
      What time of day do you feel most energized?
      1) Morning
      2) Afternoon
      3) Evening
      4) Night
      What is your favorite type of weather?
      1) Sunny and warm
      2) Rainy and cool
      3) Snowy and cold
      4) Windy and mild
      How do you handle stress?
      1) By talking to someone
      2) By exercising
      3) By doing a hobby
      4) By resting
      Which season do you prefer?
      1) Spring
      2) Summer
      3) Autumn
      4) Winter`,
      
      `What role do you typically take in a group project?
      1) Leader
      2) Organizer
      3) Innovator
      4) Supporter
      What type of books do you enjoy reading the most?
      1) Fiction
      2) Non-fiction
      3) Science fiction
      4) Biographies
      What kind of art appeals to you the most?
      1) Abstract
      2) Realism
      3) Surrealism
      4) Impressionism
      How do you prefer to spend your weekends?
      1) Socializing with friends
      2) Engaging in a hobby
      3) Relaxing at home
      4) Exploring new places
      What type of vacation do you prefer?
      1) Beach holiday
      2) Adventure trip
      3) Cultural tour
      4) Staycation`,
      
      `Which of these animals do you relate to the most?
      1) Owl
      2) Dog
      3) Cat
      4) Horse
      How do you typically solve problems?
      1) Analyzing logically
      2) Seeking advice
      3) Trusting intuition
      4) Researching thoroughly
      What is your preferred social setting?
      1) Large parties
      2) Small gatherings
      3) One-on-one conversations
      4) Solitude
      Which of these hobbies sounds most appealing to you?
      1) Painting or drawing
      2) Playing sports
      3) Cooking or baking
      4) Writing or journaling
      What is your favorite type of music?
      1) Pop
      2) Classical
      3) Rock
      4) Jazz`,
      
      `What kind of learner are you?
      1) Visual
      2) Auditory
      3) Kinesthetic
      4) Reading/Writing
      How do you approach new challenges?
      1) With enthusiasm
      2) With caution
      3) With skepticism
      4) With curiosity
      Which quality do you value most in others?
      1) Honesty
      2) Compassion
      3) Intelligence
      4) Humor
      What is your favorite way to express creativity?
      1) Through art
      2) Through writing
      3) Through music
      4) Through dance
      What is your preferred type of exercise?
      1) Running or jogging
      2) Yoga or pilates
      3) Team sports
      4) Weightlifting`,
      
      `How do you prefer to communicate?
      1) Face-to-face
      2) Over the phone
      3) Via text message
      4) Through email
      What type of cuisine do you enjoy the most?
      1) Italian
      2) Mexican
      3) Japanese
      4) Indian
      Which of these values is most important to you?
      1) Freedom
      2) Justice
      3) Equality
      4) Tradition
      What is your favorite way to spend a rainy day?
      1) Watching movies
      2) Reading a book
      3) Cooking or baking
      4) Sleeping in
      What motivates you the most?
      1) Achieving goals
      2) Helping others
      3) Learning new things
      4) Being recognized`,
      
      `What kind of environments do you thrive in?
      1) Structured and orderly
      2) Flexible and adaptable
      3) Fast-paced and dynamic
      4) Calm and steady
      What is your favorite way to unwind after a long day?
      1) Taking a bath
      2) Watching TV
      3) Talking to a friend
      4) Going for a walk
      Which of these traits best describes you?
      1) Adventurous
      2) Analytical
      3) Empathetic
      4) Creative
      What kind of TV shows do you prefer?
      1) Sitcoms
      2) Crime dramas
      3) Reality shows
      4) Sci-fi series
      What is your ideal work environment?
      1) Collaborative
      2) Independent
      3) Fast-paced
      4) Relaxed`,
      
      `What do you value most in friendships?
      1) Loyalty
      2) Trust
      3) Fun
      4) Support
      What kind of home decor do you prefer?
      1) Modern
      2) Rustic
      3) Minimalist
      4) Eclectic
      How do you prefer to spend your free time?
      1) Exploring the outdoors
      2) Creating something new
      3) Learning new skills
      4) Spending time with loved ones
      Which historical period fascinates you the most?
      1) Ancient civilizations
      2) Medieval times
      3) Renaissance
      4) Modern era
      What is your favorite way to stay active?
      1) Hiking
      2) Dancing
      3) Swimming
      4) Biking`,
      
      `What is your preferred way of traveling?
      1) By plane
      2) By car
      3) By train
      4) By boat
      How do you handle conflicts?
      1) Confronting them directly
      2) Avoiding them
      3) Seeking mediation
      4) Compromising
      What kind of movies do you avoid?
      1) Horror
      2) Musicals
      3) Rom-coms
      4) War films
      What kind of dreams do you remember most often?
      1) Adventures
      2) Nightmares
      3) Fantasies
      4) Mundane events
      What type of art do you enjoy creating?
      1) Sculptures
      2) Paintings
      3) Digital art
      4) Crafts`,
      
      `What is your favorite way to start the day?
      1) With a workout
      2) With a good breakfast
      3) With meditation
      4) With reading the news
      What kind of clothing do you prefer?
      1) Casual
      2) Formal
      3) Sporty
      4) Bohemian
      What is your favorite holiday?
      1) Christmas
      2) Halloween
      3) Thanksgiving
      4) New Year's
      How do you prefer to spend your lunch break?
      1) Socializing with colleagues
      2) Going for a walk
      3) Eating alone
      4) Running errands
      What is your ideal way to celebrate a special occasion?
      1) Hosting a party
      2) Going out to a fancy dinner
      3) Taking a trip
      4) Spending it quietly with close friends or family`,
      
      `What kind of pet do you prefer?
      1) Dog
      2) Cat
      3) Bird
      4) Fish
      How do you prefer to stay informed?
      1) Reading newspapers
      2) Watching TV news
      3) Listening to podcasts
      4) Following online news sources
      What is your favorite type of dessert?
      1) Ice cream
      2) Cake
      3) Cookies
      4) Pie
      What is your approach to new technology?
      1) Early adopter
      2) Cautious user
      3) Skeptical
      4) Indifferent
      What kind of volunteer work interests you most?
      1) Environmental conservation
      2) Animal rescue
      3) Community service
      4) Educational programs`
  ];
  
    
    const AGENT_SYSTEM_TEMPLATE = `
    ${name === '' ? 'note the use is not registered, remind him to register through the link "despierta.online/login" ' :
      
    'note that the user is called '+name+ '(registred user), you can call the user by name,'}

    You are an AI-powered chatbot called zen designed to help people find their serenity

  -Request for Information: ask questions about the user personal information to have a clear vision of his character trait and valorize the user's messages and ideas (show interest)

    **Topics you can discuss** :

    -Personal Development: Cover topics like self-awareness, overcoming personal limitations, and skill development.

    -Meditation and Mindfulness:Discuss different meditation techniques, the benefits of regular practice, and tips for beginners.

    -Alternative Therapies:Explore the different therapies offered on the platform, such as sound therapy, reiki, or aromatherapy, and their specific benefits.

    -Enlightenment and Spiritual Awakening: " Discuss key concepts about what achieving enlightenment entails and how the platform can assist in this spiritual journey.
        
    **Guidelines** :

    -utilize contextual Follow-Up Question: Base your follow-up question (one or more), guiding the conversation flow more smoothly based on the topic discussed.
    -start the conversation with an engaging question tailored to the user's potential interests, offering specific options for clarity    -when recommanding , include images and links if available

    -virtuous answer always

  Tools Usage : 

      use "Despierta-General-Knowledge" only when the user explicitely asks about general information about despierta, 
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
