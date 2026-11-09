import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";
import App from "./App.tsx";
import { wagmiConfig } from "./config.ts";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 3, refetchOnWindowFocus: true } },
});

// The wallet pop-up in the app's colours (hex versions of the tokens in index.css).
const base = darkTheme({ accentColor: "#b4f24e", accentColorForeground: "#11190a", borderRadius: "none", overlayBlur: "none" });
const theme = {
  ...base,
  colors: { ...base.colors, modalBackground: "#1c1e1a", modalBorder: "#3d4039", connectButtonBackground: "#1c1e1a", profileForeground: "#1c1e1a" },
  fonts: { body: '"Pixelify Sans", ui-sans-serif, system-ui, sans-serif' },
  shadows: { ...base.shadows, connectButton: "none", dialog: "none" },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
