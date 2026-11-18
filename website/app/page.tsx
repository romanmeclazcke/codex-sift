import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { HowItWorks } from "@/components/HowItWorks";
import { Journey } from "@/components/Journey";
import { Nav } from "@/components/Nav";
import { QuickStart } from "@/components/QuickStart";
import { Results } from "@/components/Results";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Journey />
        <Results />
        <HowItWorks />
        <QuickStart />
        <Faq />
        <FinalCta />
      </main>
    </>
  );
}
