import OpenAI from "openai";

export default function getOpenAI() {
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("Missing OpenAI envs key.");
    } else {
        return new OpenAI({apiKey: process.env.OPENAI_API_KEY})
    }
}