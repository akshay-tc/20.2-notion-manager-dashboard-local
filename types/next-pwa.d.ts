declare module "next-pwa" {
  import type { NextConfig } from "next";
  import type {
    GenerateSWOptions,
    InjectManifestOptions,
    RuntimeCaching,
  } from "workbox-build";

  export type PWAConfig = Partial<GenerateSWOptions & InjectManifestOptions> & {
    dest: string;
    disable?: boolean;
    register?: boolean;
    scope?: string;
    sw?: string;
    runtimeCaching?: RuntimeCaching[];
    publicExcludes?: string[];
    buildExcludes?: Array<string | RegExp | ((input: string) => boolean)>;
    cacheStartUrl?: boolean;
    dynamicStartUrl?: boolean;
    dynamicStartUrlRedirect?: string;
    fallbacks?: {
      document?: string;
      image?: string;
      audio?: string;
      video?: string;
      font?: string;
    };
    reloadOnOnline?: boolean;
    cacheOnFrontEndNav?: boolean;
    customWorkerDir?: string;
    customWorkerScript?: string;
  };

  export default function withPWA(
    config?: PWAConfig,
  ): (nextConfig: NextConfig) => NextConfig;
}
