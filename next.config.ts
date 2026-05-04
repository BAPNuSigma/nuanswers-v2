import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // officeparser dynamically imports `file-type` and other transitive deps at
  // runtime, which Next.js's bundler doesn't see during the static build —
  // so the deployed serverless function 500s with "Cannot find package
  // 'file-type'" when a student uploads a .pptx. Marking officeparser as
  // external tells Next.js to leave it alone and let Node's normal module
  // resolution handle it at runtime.
  serverExternalPackages: ["officeparser"],
};

export default nextConfig;
