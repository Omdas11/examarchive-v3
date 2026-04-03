# Environment Variables

This document lists all environment variables used in ExamArchive v3. All variables should be defined in your `.env.local` file (for local development) or in your deployment platform's environment settings (for production).

## Required Variables

### Appwrite Configuration (Public)

These variables are exposed to the browser (prefixed with `NEXT_PUBLIC_`):

```bash
# Appwrite endpoint URL
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1

# Your Appwrite project ID
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-appwrite-project-id

# Bucket ID for exam papers (must match server-side bucket)
NEXT_PUBLIC_APPWRITE_BUCKET_ID=papers

# Bucket ID for syllabus files (must match server-side bucket)
NEXT_PUBLIC_APPWRITE_SYLLABUS_BUCKET_ID=syllabus-files

# Your deployed site URL (for redirects and magic links)
# Vercel sets this automatically via VERCEL_PROJECT_PRODUCTION_URL
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### Appwrite Configuration (Server-Only)

These variables are **never** exposed to the browser (no `NEXT_PUBLIC_` prefix):

```bash
# Appwrite API key for server-side admin operations
# Generate this in your Appwrite console under API Keys
# Required scopes: databases, storage, users
APPWRITE_API_KEY=your-appwrite-api-key

# Bucket IDs (must match public configuration)
APPWRITE_BUCKET_ID=papers
APPWRITE_AVATARS_BUCKET_ID=avatars
APPWRITE_SYLLABUS_BUCKET_ID=syllabus-files
APPWRITE_MD_CACHE_BUCKET_ID=examarchive-md-bucket
```

### AI Services (Server-Only)

All AI service keys are **server-side only** and must never be prefixed with `NEXT_PUBLIC_`:

```bash
# OpenRouter API key for AI chat and content generation
# Required for /api/ai/chat and /api/ai/generate endpoints
# Only free-tier ($0/$0) models are allowed by the app
OPENROUTER_API_KEY=your-openrouter-api-key

# Optional: restrict to a specific free-tier allowlist (comma-separated)
# Example: meta-llama/llama-3.1-8b-instruct:free,mistralai/mistral-7b-instruct:free
# OPENROUTER_MODEL_ALLOWLIST=

# Optional: headers OpenRouter recommends for attribution
# OPENROUTER_APP_URL=https://your-domain.com
# OPENROUTER_APP_NAME=ExamArchive

# Embeddings provider for RAG (Retrieval Augmented Generation)
# Currently supports OpenAI-compatible embedding APIs
# Used for generating embeddings from uploaded PDFs
# Get your key at: https://platform.openai.com/ or any OpenAI-compatible embeddings provider
OPENAI_API_KEY=your-openai-api-key
```

> **Note**: OpenAI is only used for embeddings. Inference now routes exclusively through OpenRouter. Consider using compatible embedding alternatives like:
> - Voyage AI embeddings
> - Cohere embeddings
> - Self-hosted embedding models

### Web Search (Server-Only, Optional)

```bash
# Tavily API key for web search in AI chat and content generation
# Get your key at: https://tavily.com/
# Optional: If not set, web search will be disabled
TAVILY_API_KEY=your-tavily-api-key

# Optional: Custom Tavily-compatible endpoint
# Default: https://api.tavily.com/search
# TAVILY_SEARCH_URL=https://api.tavily.com/search
```

> **Note**: Tavily is optional. The application works without it, but AI responses won't include live web search results.

## Optional Variables

### Development Tools

```bash
# Enable the floating debug panel (only in development)
# Set to "true" in .env.local for local debugging
# NEVER set this in production or publicly accessible environments
# Requires NODE_ENV !== "production"
NEXT_PUBLIC_ENABLE_DEBUG_PANEL=false
```

### Analytics (Optional)

```bash
# Enable Google Analytics 4 tracking
# NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Enable privacy-first Simple Analytics tracking
# Set to "true" to load the script; keep "false" locally and in CI
NEXT_PUBLIC_SIMPLE_ANALYTICS_ENABLED=false
# Optional: pin the hostname for previews (defaults to window.location.hostname)
# NEXT_PUBLIC_SIMPLE_ANALYTICS_HOSTNAME=examarchive.dev
```

## Database Collections

ExamArchive requires the following Appwrite collections to be manually created in the Appwrite console:

### site_metrics
- **Collection ID**: `site_metrics`
- **Attributes**:
  - `visitor_count` (integer, default: 0)
  - `launch_progress` (integer, default: 40)
- **Documents**: Create a single document with ID `"singleton"` to hold global counters
- **Permissions**:
  - Read: `any()`
  - Write: Server key only

### feedback
- **Collection ID**: `feedback`
- **Attributes**:
  - `name` (string)
  - `university` (string)
  - `text` (string)
  - `approved` (boolean, default: false)
- **Permissions**:
  - Read: `users()`
  - Write: `users()`
  - Update/Delete: Server key only

### ai_usage
- **Collection ID**: `ai_usage`
- **Attributes**:
  - `user_id` (string, required)
  - `date` (string, required, format: YYYY-MM-DD)
- **Purpose**: Track daily AI generation usage for rate limiting
- **Daily Limit**: 5 generations per user per day (admin/founder roles exempt)
- **Permissions**: Server key only
- **Recommended Index**: Create compound index on `(user_id, date)` for efficient queries

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for complete schema documentation.

## Security Best Practices

1. **Never commit `.env.local` to git** - It's already in `.gitignore`
2. **Never use `NEXT_PUBLIC_` for API keys** - This exposes them to the browser
3. **Rotate API keys regularly** - Especially if they may have been compromised
4. **Use different keys for development and production**
5. **Set restrictive permissions** on Appwrite API keys (grant only necessary scopes)
6. **Monitor API usage** - Watch for unexpected spikes that might indicate key compromise

## Vercel Deployment

When deploying to Vercel:

1. All environment variables should be added in the Vercel dashboard under **Settings > Environment Variables**
2. `NEXT_PUBLIC_SITE_URL` is automatically set by Vercel (via `VERCEL_PROJECT_PRODUCTION_URL`)
3. Mark sensitive variables (API keys) as **Sensitive** in Vercel to hide them from logs
4. Use different values for **Production**, **Preview**, and **Development** environments as needed

## Local Development Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in all required variables in `.env.local`

3. Verify your configuration:
   ```bash
   npm run dev
   ```

4. Check the browser console and server logs for any missing variable warnings

## Troubleshooting

### "AI generation is not configured"
- Ensure `OPENROUTER_API_KEY` is set in your environment
- Verify the key is valid and not expired

### "Service temporarily unavailable"
- Verify your OpenRouter key has sufficient quota and is active
- Confirm your allowlist models are currently marked as $0 for both prompt and completion costs
- Check OpenRouter service status or try a different free model from the allowlist

### "Login required" / Authentication issues
- Verify all `NEXT_PUBLIC_APPWRITE_*` variables are set correctly
- Check that `APPWRITE_API_KEY` has proper permissions (databases, users)
- Ensure the Appwrite project ID matches across public and server variables

### Embeddings/RAG not working
- Verify `OPENAI_API_KEY` is set (or another OpenAI-compatible embedding provider)
- Check that the `ai_embeddings` collection exists in Appwrite
- Ensure PDF uploads are processing correctly

### Web search not working
- This is normal if `TAVILY_API_KEY` is not set (web search is optional)
- If set, verify the key is valid and has quota remaining
- Check network connectivity to Tavily API

## Migration Notes

### Removing OpenAI Dependency

The codebase currently uses OpenAI only for embeddings. To fully migrate to open-source embedding alternatives:

1. **For embeddings**, consider:
   - Voyage AI: https://www.voyageai.com/
   - Cohere: https://cohere.com/
   - Self-hosted: sentence-transformers, Ollama

2. Update `src/lib/pdf-rag.ts` to use the new embedding provider

3. Remove `OPENAI_API_KEY` from environment variables

4. Update this documentation accordingly
