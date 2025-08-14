# Digital Strategy Bot

A Next.js-based AI assistant web application powered by OpenAI, optimized for seamless deployment and modern web standards.

---

## 🚀 Features

- **Next.js 14**: Bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app) for a robust React framework.
- **OpenAI API Integration**: All AI interactions are securely handled via the OpenAI API using JavaScript/TypeScript.
- **Modern UI/UX**: Built with [Tailwind CSS](https://tailwindcss.com), [framer-motion](https://www.framer.com/motion/), and [react-markdown](https://github.com/remarkjs/react-markdown) for a responsive, interactive experience.
- **PDF/Export Support**: Generate PDFs with [jspdf](https://github.com/parallax/jsPDF) and capture screenshots with [html2canvas](https://github.com/niklasvh/html2canvas).
- **Ready for Cloud Deployment**: Deploy easily to Cloudflare Pages or Vercel.
- **TypeScript First**: Fully typed for scalability and maintainability.

This is a PWA - i.e. you can save and run this web app locally with almost native feel like an app on iOS and Android compatible sets.
---

## 📦 Installation

Clone the repository and install dependencies:

```sh
git clone <your-repo-url>
cd digital-strategy
npm install
```

---

## 🧩 Dependencies

All dependencies are managed via [`package.json`](package.json).  
Check and periodically update this file for any new requirements.

**Main dependencies:**

- [next](https://nextjs.org/)
- [react](https://react.dev/)
- [react-dom](https://react.dev/)
- [axios](https://axios-http.com/)
- [framer-motion](https://www.framer.com/motion/)
- [jspdf](https://github.com/parallax/jsPDF)
- [react-markdown](https://github.com/remarkjs/react-markdown)
- [remark-gfm](https://github.com/remarkjs/remark-gfm)
- [html2canvas](https://github.com/niklasvh/html2canvas)
- [@tailwindcss/postcss](https://tailwindcss.com/docs/installation)
- [tailwindcss](https://tailwindcss.com/)
- [typescript](https://www.typescriptlang.org/)

Install all dependencies with:

```sh
npm install
```

> **Note:**  
> This project does **not** use Python or Python-based models. AI is handled exclusively via the OpenAI API.

---

## 💻 Running Locally

Start the development server:

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ Building for Production

To build the app for production:

```sh
npm run build
```

The production-ready files will be in the `.next/` directory (or `out/` if exported statically).

---

## 🚀 Deployment

### Cloudflare Pages

Deploy using Wrangler:

```sh
npm run deploy
```

### Vercel

1. [Deploy on Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme)
2. Select your repository and environment variables as described below.

By default a CI/CD pipeline has been setup to trigger automated builds on Vercel for any new commits.
---

## 🔐 Environment Variables

Create a `.env` file in your project root with the following:

```
OPENAI_ASSISTANT_ID=your-assistant-id
OPENAI_API_KEY=your-openai-api-key
OPENAI_ORGANIZATION=your-openai-org-id (optional)
```

When deploying to Vercel/Cloudflare, set the same variables in your project settings to keep them secure.

---

## 📄 License

Distributed under the [MIT License](LICENSE).

---

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs) — features and API.
- [Learn Next.js](https://nextjs.org/learn) — interactive tutorial.
- [Next.js GitHub](https://github.com/vercel/next.js) — feedback and contributions welcome!
- [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) — deploy your app in minutes.

---
