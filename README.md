This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Contact form email

The contact form sends messages through a server-side Resend API call. The recipient address is read from `CONTACT_TO_EMAIL`, or from the existing server-only `MILK_OWNER_EMAIL` setting if `CONTACT_TO_EMAIL` is blank. Set `RESEND_API_KEY` and `CONTACT_FROM_EMAIL` in `.env.local` for development and in the deployment host's environment settings for production. The sender must use a domain verified with Resend. These values are only read by the server route; do not prefix them with `NEXT_PUBLIC_`.

Example `.env.local` entries:

```text
RESEND_API_KEY=re_...
CONTACT_FROM_EMAIL=Perkrucible <messages@your-verified-domain.com>
CONTACT_TO_EMAIL=
```

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## HEAVY METAL card collection

The collection is public to browse. Only the site owner needs to sign in to add, edit, or remove cards. Each PDF page is saved as one card image. Card images and trade inquiries are stored in the existing Neon database, and inquiries appear in the owner-only inbox. Email notifications require `RESEND_API_KEY` and a verified sender in `RESEND_FROM_EMAIL` or `CONTACT_FROM_EMAIL`. The recipient is chosen from `TRADE_INQUIRY_TO_EMAIL`, `CONTACT_TO_EMAIL`, or `MILK_OWNER_EMAIL` in that order. The visitor email is only used to reply to the inquiry and is not used for promotions.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
