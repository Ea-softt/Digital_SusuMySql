
import { GoogleGenAI, Chat } from "@google/genai";

let chatSession: Chat | null = null;
let genAI: GoogleGenAI | null = null;

const SYSTEM_INSTRUCTION = `
You are the "Susu Advisor", a helpful AI assistant embedded in the Digital Susu application.
Your role is to help members and group leaders understand how the Susu (ROSCA) system works, provide general financial tips on saving and budgeting, and navigate the application.

Key Knowledge:
- A Susu is a Rotating Savings and Credit Association.
- Members contribute a fixed amount periodically.
- One member takes the lump sum (pot) each period.
- It relies on trust and community.

Tone: Professional, encouraging, financial-savvy, and friendly.
Format: Keep answers concise (under 150 words usually) unless asked for a detailed explanation.
Currencies: Defaults to GHS (Ghana Cedis) or USD depending on context, but be generic if unsure.
`;

export const initializeGemini = (): void => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("Gemini API Key is missing");
    return;
  }
  genAI = new GoogleGenAI({ apiKey });
};

export const getChatSession = (): Chat => {
  if (!genAI) {
    initializeGemini();
  }
  
  if (!chatSession && genAI) {
    // Correctly using gemini-3-flash-preview for basic text tasks
    chatSession = genAI.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });
  }
  
  if (!chatSession) {
    throw new Error("Failed to initialize Gemini Chat Session");
  }

  return chatSession;
};

export const sendMessageToAdvisor = async (message: string): Promise<string> => {
  try {
    const session = getChatSession();
    const result = await session.sendMessage({ message });
    // Use property access for response text as per guidelines
    return result.text || "I'm sorry, I couldn't process that response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I am currently having trouble connecting to the financial knowledge base. Please try again later.";
  }
};
