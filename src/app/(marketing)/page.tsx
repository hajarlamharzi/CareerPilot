import type { Metadata } from "next";

import { APP_DESCRIPTION, APP_NAME } from "@/config/app";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { PrivacyBand } from "@/components/marketing/privacy-band";
import { CtaBand } from "@/components/marketing/cta-band";

export const metadata: Metadata = {
  title: `${APP_NAME} — AI-assisted job search, privately in your browser`,
  description: APP_DESCRIPTION,
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <PrivacyBand />
      <CtaBand />
    </>
  );
}
