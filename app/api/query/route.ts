import { pipeline } from "@xenova/transformers";
import { getSupabaseAdmin } from "@/utils/supabase/supabase-admin";
import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getEnvVar } from "@/utils/env";
import getOpenAI from "@/utils/openai-admin";
import {
    AutoTokenizer,
    SiglipTextModel,
  } from "@xenova/transformers";

export const runtime = "nodejs";            // ensure Node runtime (not Edge)
export const dynamic = "force-dynamic";

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

  type Match = { image_url: string; file?: string | null; page?: number };

  function toVisionMessage(
    question: string,
    matches: Match[],
    prefixText: string
  ) {
    const header = [
      {
        type: "text" as const,
        text:
          `${prefixText}\n\n` +
          `User question: "${question}"\n\n` +
          `You will receive 1 or more images. Each image is preceded by a one-line descriptor of the file name and page number.\n` +
          `Use the providednames and page numbers when citing evidence.`,
      },
    ];
  
    const parts = matches.flatMap((m, i) => {
      const id = `IMG-${i + 1}`;
      const file = m.file ?? "unknown";
      const page = m.page ?? "unknown";
      const descriptor =
        `${id}: file_name=${file} page=${page}`;
  
      return [
        { type: "text" as const, text: descriptor },
        {
          type: "image_url" as const,
          image_url: { url: m.image_url, /* optional: */ detail: "high" as const },
        },
      ];
    });
  
    return [...header, ...parts];
  }
  
  function parseJsonLoose(s: string) {
    // Try straight parse first
    try {
      return JSON.parse(s);
    } catch {}
    // Extract the first JSON object found
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const candidate = s.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch {}
    }
    // Nothing parsable
    throw new Error("Model did not return valid JSON.");
  }
  
  function clampAnswerShape(obj: any) {
    // Ensure required fields exist with sane defaults
    return {
      answer: typeof obj?.answer === "string" ? obj.answer : "",
      value_text:
        typeof obj?.value_text === "string" ? obj.value_text : null,
      units: typeof obj?.units === "string" ? obj.units : null,
      value_numeric:
        typeof obj?.value_numeric === "number"
          ? obj.value_numeric
          : null,
      scale_used:
        typeof obj?.scale_used === "string" ? obj.scale_used : null,
      evidence: Array.isArray(obj?.evidence)
        ? obj.evidence
            .map((e: any) => ({
              type:
                typeof e?.type === "string" ? e.type : null, // "dimension|note|symbol|schedule"
              image_url:
                typeof e?.image_url === "string" ? e.image_url : null,
              file:
                typeof e?.file === "string" ? e.file : null,
              page:
                typeof e?.page === "number" ? e.page : null,
              confidence:
                typeof e?.confidence === "number"
                  ? Math.max(0, Math.min(1, e.confidence))
                  : null,
            }))
            .filter((e: any) => e.type || e.image_url)
        : [],
      assumptions: Array.isArray(obj?.assumptions)
        ? obj.assumptions.filter((a: any) => typeof a === "string")
        : [],
      confidence:
        typeof obj?.confidence === "number"
          ? Math.max(0, Math.min(1, obj.confidence))
          : null,
    };
  }
  
  
  // Phase 1: EXTRACT (structured, no prose)
  async function runExtractPhase(question: string, matches: Match[]) {
    const openai = getOpenAI()
    const schema = `
  Return ONLY valid minified JSON with this schema:
  {
    "scale_candidates": [ { "text": string, "confidence": number } ],
    "units_candidates": [ { "text": string, "confidence": number } ],
    "legend_items": [ { "symbol": string, "meaning": string } ],
    "notes_candidates": [ { "text": string } ],  
    "schedule_snippets": [ { "kind": "door|window|finish|other", "snippet": string } ],
    "observations": [ string ]
  }
  `;
  
    const prompt = `You extract structured facts from architectural drawings.
  - Identify any declared drawing scales and likely units.
  - Extract legend pairs (symbol → meaning) if visible.
  - Extract all schedules and notes from the image.
  - Do NOT answer the user's question here.
  - Output strict JSON only (no markdown, no prose).
  - It is VITAL that you only document REAL information you observe do not make anything up.
  ${schema}`;
  
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini", // vision-capable
      temperature: 0,
      messages: [
        { role: "system", content: "You are a precise extraction engine for architectural drawings." },
        { role: "user", content: toVisionMessage(question, matches, prompt) as any },
      ],
    });
  
    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = parseJsonLoose(raw);
    return parsed;
  }
  
  // Phase 2: ANSWER (grounded, with evidence + confidence)
  async function runAnswerPhase(
    question: string,
    matches: Match[],
    extracted: any
  ) {
    const openai = getOpenAI()
    const answerSchema = `
  Return ONLY valid minified JSON with this schema:
  {
    "answer": string,                 // short, decisive
    "value_text": string|null,        // if textual/material answer
    "value_numeric": number|null,     // if applicable
    "units": "count|ft-in|mm|cm|m|material|text|null", // if applicable
    "evidence": [
      {
        "type": "dimension|note|symbol|schedule|legend|titleblock|other",
        "file": string|null,
        "page": number|null,
        "image_url": string|null,
        "confidence": number|null
      }
    ],
    "assumptions": [string],
    "confidence": number              // 0..1, calibrated by source quality
  }
  `;
  
    const guidance = `You are answering a question about architectural drawings using ONLY what is visible in the provided images and the extracted data.
  
  Rules:
  - Prefer explicit dimensions and notes.
  - If you cannot be certain, provide your best answer AND list assumptions.
  - Keep "answer" concise and concrete.
  - Provide at least one evidence item file and page number.
  - Output strict JSON only. No markdown. No extra text.
  
  ${answerSchema}
  
  Extracted data for grounding:
  ${JSON.stringify(extracted)}`;
  
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "You are a careful, evidence-driven architectural assistant. Always return strict JSON." },
        { role: "user", content: toVisionMessage(question, matches, guidance) as any },
      ],
    });
  
    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = clampAnswerShape(parseJsonLoose(raw));
  
    // If the model forgot to include any evidence, add a low-confidence image-only reference
    if (!parsed.evidence?.length && matches.length) {
      parsed.evidence = [
        {
          type: "other",
          file: matches[0].file ?? null,
          page: matches[0].page ?? null,
          image_url: matches[0].image_url,
          confidence: 0.2,
        },
      ];
    }
  
    return parsed;
  }



async function queryPdf(question: string) {
  const supabase = getSupabaseAdmin()
  // 1️⃣ Convert query → embedding
  const queryEmbedding = await getTextEmbedding(question);

  const embeddingArray = Array.from(queryEmbedding!); // Float32Array -> JS array

  // 2️⃣ Search in Supabase
  const { data: matches, error } = await supabase.rpc("match_img_embeddings", {
    query_embedding: embeddingArray,
    match_threshold: 0.0,
    match_count: 5,
  });

  if (error) throw error;
  console.log(matches)

  const visionMatches: Match[] = (matches ?? []).map((m: any) => ({
    image_url: m.image_url,
    file: m.file ?? null,
    page: m.page ?? null,
  }));

  if (!visionMatches.length) {
    return {
      answer: "No matching documents retrieved.",
      value_text: null,
      value_numeric: null,
      units: null,
      evidence: [],
      assumptions: [],
      confidence: 0,
      _debug: { matches: [] },
    };
  }

  // 3) Phase 1: Extract
  const extracted = await runExtractPhase(question, visionMatches);
  console.log(extracted)

  // 4) Phase 2: Answer
  const answerJson = await runAnswerPhase(question, visionMatches, extracted);

  // 5) Return combined result
  console.log(answerJson)
  // return {
  //   ...answerJson,
  //   _debug: {
  //     extracted,             // keep for inspection
  //     retrieved_count: visionMatches.length,
  //     files: visionMatches.map((m) => ({ file: m.file ?? null, page: m.page ?? null, image_url: m.image_url })),
  //   },
  // }
  return answerJson;

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
