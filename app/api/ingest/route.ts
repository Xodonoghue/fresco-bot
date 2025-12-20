// app/api/ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fromBuffer } from "pdf2pic";
import sharp from "sharp";
import fs from "fs/promises";
import getOpenAI from "@/utils/openai-admin";
import { getSupabaseAdmin } from "@/utils/supabase/supabase-admin";
import {
  AutoTokenizer,
  SiglipTextModel,
  AutoProcessor,
  SiglipVisionModel,
  RawImage,
} from "@xenova/transformers";

interface UploadedFile {
  id: string
  name: string
  size: number
  uploadedAt: Date
}

// Temporary storage
const UPLOAD_DIR = "/tmp/pdf_uploads";
const UPLOAD_BUCKET = 'img-assets'

function normalizeEmbedding(vec: Float32Array): Float32Array {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return new Float32Array(vec.map((v) => v / norm));
}

// ---------- IMAGE HELPERS ----------
async function bufferToRawImage(imgBuffer: Buffer) {
  const image = sharp(imgBuffer).removeAlpha().raw();
  const { data, info } = await image.toBuffer({ resolveWithObject: true });

  return new RawImage(
    data,
    info.width,
    info.height,
    info.channels as 1 | 2 | 3 | 4
  );
}

// ---------- LOAD SIGLIP ----------
let textTokenizer: any = null;
let textModel: any = null;
let visionProcessor: any = null;
let visionModel: any = null;

async function loadSigLIP() {
  if (!textTokenizer || !textModel || !visionProcessor || !visionModel) {
    textTokenizer = await AutoTokenizer.from_pretrained(
      "Xenova/siglip-base-patch16-224"
    );
    textModel = await SiglipTextModel.from_pretrained(
      "Xenova/siglip-base-patch16-224"
    );

    visionProcessor = await AutoProcessor.from_pretrained(
      "Xenova/siglip-base-patch16-224"
    );
    visionModel = await SiglipVisionModel.from_pretrained(
      "Xenova/siglip-base-patch16-224"
    );
  }
  return { textTokenizer, textModel, visionProcessor, visionModel };
}

// ---------- PDF TO IMAGES ----------
async function pdfToImageBuffers(file: File): Promise<Buffer[]> {
  const buf = Buffer.from(await file.arrayBuffer());
  const options = {
    density: 150,
    format: "jpeg",
    width: 1024,
    height: 1024,
    saveFilename: "unused",
    savePath: "",
  };

  const convert = fromBuffer(buf, options);
  const result = await convert.bulk(-1, { responseType: "buffer" });
  return result.map((r) => r.buffer as Buffer);
}

// ---------- EMBEDDINGS ----------
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

async function getImageEmbedding(imgBuffer: Buffer) {
  const { visionProcessor, visionModel } = await loadSigLIP();

  const rawImg = await bufferToRawImage(imgBuffer);
  const imageInputs = await visionProcessor(rawImg);
  const output = await visionModel(imageInputs);
  return normalizeEmbedding(output.pooler_output.data); // Float32Array
}

// simple-qwen-call.ts
async function getDescription(imageUrl: string): Promise<string | null> {
  const prompt = `You are analyzing architectural drawings and plans. Your job is to scan the image below and provide a textual description describing everything you see in the image. This includes things like measurements, heights, counts of objects, material indicators, notes, scales dimensions etc. It is VITAL that you DON'T MAKE ANY INFORMATION UP. USE ONLY THE IMAGE to create this description>`;

  // 4️⃣ Send to GPT-4o (multimodal capable)
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini", // supports vision + text
    messages: [
      { role: "system", content: "You are a helpful assistant for architectural drawings." },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: { url: imageUrl },
          },
        ],
      },
    ],
  });

  return response.choices[0].message.content;
}


// ---------- MAIN INGEST ----------
async function ingestPdf(file: File): Promise<UploadedFile | undefined> {
  const supabase = getSupabaseAdmin()
  const pageImages = await pdfToImageBuffers(file);

  for (let i = 0; i < pageImages.length; i++) {
    const imgBuffer = pageImages[i];

    const filename = `${Date.now()}_${i + 1}.jpg`;
    const { data: upload, error: uploadErr } = await supabase.storage
      .from(UPLOAD_BUCKET)
      .upload(filename, imgBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadErr) throw uploadErr;

    // get a public URL
    const { data: publicUrl } = supabase.storage
      .from(UPLOAD_BUCKET)
      .getPublicUrl(filename);

    const imageUrl = publicUrl.publicUrl;

    // a) Image embedding
    const imgEmbedding = await getImageEmbedding(imgBuffer);

    // b) Text embedding
    const description = await getDescription(imageUrl);
    const textEmbedding = await getTextEmbedding(description!);

    // Store in Supabase
    const { data, error } = await supabase.from("pdf_embeddings").insert({
      file: file.name,
      page: i + 1,
      description: description,
      text_embedding: Array.from(textEmbedding!),
      image_embedding: Array.from(imgEmbedding),
      image_url: imageUrl,
    });

    if (!error) {
      if (i === pageImages.length - 1) {
        const outPut: UploadedFile = { id: Math.random().toString(36).substr(2, 9), name: file.name, size: file.size, uploadedAt: new Date() }
        return outPut
      } else {
        console.log(`Finished page ${i}`)
      }
    } else {
      throw new Error(error.message)
    }

  }
}

// ---------- API ROUTE ----------
export async function POST(req: NextRequest) {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    if (!files.length) {
      return NextResponse.json({ error: "No files" }, { status: 400 });
    }

    let uploadedFiles: UploadedFile[] = []
    for (const file of files) {
      const newFile = await ingestPdf(file);
      uploadedFiles = [...uploadedFiles, newFile!]
    }

    return NextResponse.json({
      files: uploadedFiles,
      message: "PDF processed with SigLIP (text + image embeddings)",
    });
  } catch (err: any) {
    console.error("Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

