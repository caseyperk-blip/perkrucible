import type { Metadata } from "next";
import { TradingCollection } from "./TradingCollection";

export const metadata: Metadata = {
  title: "HEAVY METAL Trading Cards - Wave 1 Genesis Set - UP FOR TRADE!",
  description: "Browse the HEAVY METAL trading card collection and inquire about trades.",
};

export default function PhotosPage() {
  return <TradingCollection />;
}
