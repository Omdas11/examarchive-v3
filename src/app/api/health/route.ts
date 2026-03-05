export async function GET() {
  return Response.json({
    status: "ok",
    appwrite: !!process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  })
}
