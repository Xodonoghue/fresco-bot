import { pipeline } from "@xenova/transformers";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import {
    AutoTokenizer,
    SiglipTextModel,
    AutoProcessor,
    SiglipVisionModel,
    RawImage,
  } from "@xenova/transformers";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

let textTokenizer: any = null;
let textModel: any = null;

async function loadSigLIP() {
    if (!textTokenizer || !textModel) {
      textTokenizer = await AutoTokenizer.from_pretrained(
        "Xenova/siglip-base-patch16-224"
      );
      textModel = await SiglipTextModel.from_pretrained(
        "Xenova/siglip-base-patch16-224"
      );
    }
      return { textTokenizer, textModel};
    }

let textExtractor: any = null;
async function loadTextExtractor() {
  if (!textExtractor) {
    textExtractor = await pipeline("feature-extraction", "Xenova/siglip-base-patch16-224");
  }
  return textExtractor;
}

function normalizeEmbedding(vec: Float32Array): Float32Array {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    return new Float32Array(vec.map((v) => v / norm));
  }

async function getTextEmbedding(text: string) {
    const { textTokenizer, textModel } = await loadSigLIP();
  
    const inputs = await textTokenizer(text, {
      return_tensors: "pt",
      padding: true,
      truncation: true,
    });
  
    const output = await textModel(inputs);
    // Use pooled output (already reduced to a single vector)
    if (output.pooler_output) {
      return normalizeEmbedding(output.pooler_output.data); // Float32Array
    }
  
    // Fallback: CLS pooling from last_hidden_state
    if (output.last_hidden_state) {
      const hidden = output.last_hidden_state;
      const hiddenSize = hidden.dims[2]; // [batch, seq_len, hidden_size]
      const clsEmbedding = hidden.data.slice(0, hiddenSize);
      return normalizeEmbedding(clsEmbedding);
    }
  }

async function queryPdf(question: string) {
  // 1️⃣ Convert query → embedding
  const queryEmbedding = await getTextEmbedding(question);

  const embeddingArray = Array.from(queryEmbedding!); // Float32Array -> JS array

  console.log(embeddingArray)
  // 2️⃣ Search in Supabase
  const { data: matches, error } = await supabase.rpc("match_img_embeddings", {
    query_embedding: embeddingArray,
    match_threshold: -1.0,
    match_count: 5,
  });

  if (error) throw error;
  console.log(matches)

  // 3️⃣ Build GPT prompt with images + captions
  const prompt = `You are analyzing architectural drawings. The user asked: "${question}". Use the provided images to answer accurately.`;

  // 4️⃣ Send to GPT-4o (multimodal capable)
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini", // supports vision + text
    messages: [
      { role: "system", content: "You are a helpful assistant for architectural drawings." },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          ...matches.map((m: any) => ({
            type: "image_url",
            image_url: {url: m.image_url},
          })),
        ],
      },
    ],
  });

  return response.choices[0].message.content;
}

export async function POST(req: NextRequest) {
    const { query } = await req.json()
    try {
        if (!query || typeof query !== "string") {
            throw new Error("Error processing query")
        }
        const answer = await queryPdf(query)
        return NextResponse.json({status:200, data:answer})
    } catch (e : any) {
        console.error("Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
