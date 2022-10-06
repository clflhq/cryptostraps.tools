import { getPlatformFeeAccounts } from "@jup-ag/core";
import { JupiterProvider } from "@jup-ag/react-hook";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import Head from "next/head";
import { useState, useEffect } from "react";
import JupiterForm from "../components/jupiter-swap";
import { useBalance } from "../contexts/BalanceProvider";
import { ImageURI } from "../util/image-uri";

function ShdwSwapPage() {
  const { shdwBalance, solBalance } = useBalance();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [platformFeeAndAccounts, setPlatformFeeAndAccounts] =
    useState(undefined);
  useEffect(() => {
    (async () => {
      if (process.env.NEXT_PUBLIC_JUPITER_FEE_DESTINATION) {
        const feeAccs = await getPlatformFeeAccounts(
          connection,
          new PublicKey(process.env.NEXT_PUBLIC_JUPITER_FEE_DESTINATION)
        );
        setPlatformFeeAndAccounts({
          feeBps: +(process.env.NEXT_PUBLIC_JUPITER_FEE_AMOUNT || 0),
          feeAccounts: feeAccs,
        });
      }
    })();
  }, [connection]);
  return (
    <>
      <Head>
        <title>🛠️ Cryptostraps Tools - Swap</title>
      </Head>
      <div className="mb-3 max-w-full text-center">
        <h1 className="text-4xl text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ImageURI.GenesysGo}
            alt=""
            className="mr-3"
            style={{
              width: 48,
              height: 48,
              display: "inline",
            }}
          />
          SHDW Swap
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ImageURI.GenesysGo}
            alt=""
            className="ml-3"
            style={{
              width: 48,
              height: 48,
              display: "inline",
            }}
          />
        </h1>
        {!!shdwBalance && (
          <div className="mt-3">
            <span className="badge badge-success">{shdwBalance} SHDW</span>
            <span className="ml-3 badge badge-primary">{solBalance} SOL</span>
          </div>
        )}
        <hr className="my-4 opacity-10" />
      </div>
      <JupiterForm />
    </>
  );
}

export default ShdwSwapPage;
