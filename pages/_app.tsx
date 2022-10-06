import "../styles/globals.css";

import { ConnectionProvider } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AppProps } from "next/app";
import dynamic from "next/dynamic";
import Head from "next/head";
import { ModalProvider } from "../contexts/ModalProvider";
import SideMenu from "../components/side-menu";
import TopMenu from "../components/top-menu";
import { ImageURI } from "../util/image-uri";
import { FileProvider } from "../contexts/FileProvider";
import { MadeWithLove } from "../components/made-with-love";
import { PerformanceProvider } from "../contexts/PerformanceProvider";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { BalanceProvider } from "../contexts/BalanceProvider";
import SideMenuLarge from "../components/side-menu-lg";

const endpoint = process.env.NEXT_PUBLIC_RPC;

const WalletProvider = dynamic(
  () => import("../contexts/ClientWalletProvider"),
  {
    ssr: false,
  }
);

const Providers = ({ children }: { children: JSX.Element }) => {
  if (endpoint === undefined) {
    throw new Error("Missing NEXT_PUBLIC_RPC in env file");
  }
  return (
    <FileProvider>
      {/* @ts-ignore */}
      <ToastContainer theme="dark" />
      <ModalProvider>
        <ConnectionProvider
          endpoint={endpoint}
          config={{
            confirmTransactionInitialTimeout: 120000,
            // TODO: only do this where needed
            commitment: "finalized",
            disableRetryOnRateLimit: false,
          }}
        >
          <WalletProvider>
            <PerformanceProvider>
              <BalanceProvider>{children}</BalanceProvider>
            </PerformanceProvider>
          </WalletProvider>
        </ConnectionProvider>
      </ModalProvider>
    </FileProvider>
  );
};

function Context({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Head>
        <title>🛠️ Cryptostraps Tools</title>
      </Head>
      <div className="drawer drawer-end">
        <input id="my-drawer" type="checkbox" className="drawer-toggle" />
        <div className="relative h-screen drawer-content lg:ml-64">
          <div className="hidden absolute right-0 top-4 z-50 p-4 lg:inline-block">
            <WalletMultiButton className="w-full" />
          </div>
          <div className="lg:hidden">
            <TopMenu />
          </div>
          <SideMenuLarge />

          <main
            className={`relative col-span-2 mt-28 mb-12 lg:col-span-1`}
            style={{ maxWidth: "100%" }}
          >
            <div className="px-6 mx-auto max-w-full" style={{ width: 1200 }}>
              {children}
            </div>
          </main>
          <div className="hidden fixed right-6 bottom-6 text-center xl:block">
            RPC powered by
            <a
              href="https://twitter.com/GenesysGo"
              target="_blank"
              rel="noreferrer noopener"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="mx-auto w-16"
                src={ImageURI.GenesysGo}
                alt="Genesysgo"
              />
            </a>
          </div>
        </div>

        <SideMenu />
      </div>
    </>
  );
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Providers>
      <Context>
        {/* @ts-ignore */}
        <Component {...pageProps} />

        <hr className="mt-8 opacity-10" />

        <div className="mt-auto w-full">
          <div
            className={`flex flex-row gap-4 justify-center items-center mt-6 text-center`}
          >
            <MadeWithLove />
          </div>
        </div>
      </Context>
    </Providers>
  );
}
export default MyApp;
