export async function GET() {
  return Response.json({
    status: "ok",
    supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    appwrite: !!process.env.APPWRITE_ENDPOINT
  })
}
