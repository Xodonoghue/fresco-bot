import { NextRequest,NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/utils/supabase/supabase-admin";

export async function POST(req: NextRequest) {
    try {
        const supabase = getSupabaseAdmin()
        const { error } = await supabase.rpc("admin_truncate", { target: "pdf_embeddings" });
        if (error) {
          // If the function isn't created yet, surface a clear error.
          throw new Error(`Failed to truncate table: ${error.message}`);
        }
        return NextResponse.json({status:200})
    } catch(e) {
        return NextResponse.json({error:e, status:500})
    }
}