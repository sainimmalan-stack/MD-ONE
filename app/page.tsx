"use client";
import "./community.css";
import "./grocery.css";
import { HostedAccess } from "@/components/hosted-access";
import { DemoApp } from "@/components/demo-app";
export default function App() {
  return process.env.NEXT_PUBLIC_HOSTED_AUTH === "true" ? (
    <HostedAccess />
  ) : (
    <DemoApp />
  );
}
