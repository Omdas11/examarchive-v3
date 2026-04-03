# Architecture Proposal: Server-Side PDF Generation Pipeline

## Current State & Limitations
Currently, ExamArchive generates AI study notes via an SSE stream and relies on **Client-Side Rendering (CSR)** to convert the Markdown/LaTeX into a PDF (e.g., via `react-pdf`, `html2pdf.js`, or the browser's native print dialog).
* **Limitations:**
  1. **Mobile Crashing:** Rendering a 30+ page PDF with complex Cartesian equations consumes massive device RAM, frequently crashing mobile browsers.
  2. **Tab Locking:** The user must keep the browser tab open and active during the entire generation and rendering process.
  3. **Inconsistent Styling:** CSS `@media print` behaves differently across Chrome, Safari, and Firefox (e.g., overlapping footers, blank pages).

## Proposed Future Architecture: Decoupled Server-Side Rendering (SSR)
To achieve enterprise-scale reliability, we will move PDF rendering entirely to the backend. The user will trigger the generation and can immediately close the app. The system will handle the heavy lifting asynchronously.

### Step-by-Step Execution Flow
1. **The Request:** User clicks "Generate". The frontend sends a request to the backend and subscribes to a lightweight tracking socket/stream.
2. **AI Generation:** The backend streams the prompt to OpenRouter/Groq in parallel batches. The stitched Markdown is saved to the Appwrite Storage Bucket (as currently implemented).
3. **The PDF Worker:** Instead of sending the Markdown back to the client to render, the backend triggers a dedicated Serverless PDF Worker (e.g., via a Webhook).
4. **Headless Rendering:** The worker uses a headless browser (Puppeteer/Playwright) or a dedicated LaTeX-to-PDF engine (like Pandoc or Gotenberg) to render the Markdown into a perfectly formatted, paginated PDF.
5. **PDF Storage:** The worker uploads the final `.pdf` file to a new Appwrite Bucket (`ExamArchive_PDF_Finals`).
6. **Delivery:**
   * **In-App:** If the user is still on the site, a Web Notification fires.
   * **Email:** An automated email via Resend/Nodemailer is sent to the user: *"Your notes are ready! [Click here to download]"*. The link directly serves the PDF from the Appwrite bucket.

### Technology Stack Options for PDF Worker
* **Gotenberg:** A Docker-powered stateless API for PDF generation. Excellent for transforming Markdown/HTML to PDF with strict margins and headers. (Self-hosted or managed).
* **Browserless.io / PDFMonkey:** Third-party APIs where we send the HTML/Markdown payload, and they return a finished PDF. Prevents Vercel serverless function timeouts.
* **AWS Lambda + Puppeteer-Core:** A custom microservice designed strictly to handle large RAM allocation for headless Chromium PDF printing.

## Phase 1 Implementation Goals
- [ ] Set up a dedicated Next.js API route (or external microservice) specifically for receiving Markdown and returning a PDF buffer.
- [ ] Integrate Nodemailer/Resend for delivery.
- [ ] Update the UI to show a "Job Queued" state instead of a live "Streaming Text" state for background tasks.
