import type { Metadata } from "next";
import { SolarDashboard } from "./solar-dashboard";

export const metadata: Metadata = {
  title: "Solaris Grid | Solar Forecasting & Inverter Intelligence",
  description:
    "Multi-horizon solar generation forecasts and early inverter anomaly detection.",
};

export default function Home() {
  return <SolarDashboard />;
}
