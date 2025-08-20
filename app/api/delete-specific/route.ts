import { NextRequest,NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/utils/supabase/supabase-admin";

export async function POST(req: NextRequest) {
    try {
       const { file } = await req.json()
        const supabase = getSupabaseAdmin()
        const { data, error } = await supabase
            .from("pdf_embeddings")
            .delete()
            .eq("file", file);
        return NextResponse.json({status:200})
    } catch(e) {
        return NextResponse.json({error:e, status:500})
    }
}