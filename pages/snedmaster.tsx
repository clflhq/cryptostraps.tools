import React, { useCallback, useMemo, useState } from "react";
import jsonFormat from "json-format";
import { download } from "../util/download";
import { CopyToClipboard } from "../components/copy-to-clipboard";
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import IdField from "../components/id-field";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { MEMO_ID } from "../util/accounts";
import { toPublicKey } from "../util/to-publickey";
import { getBlockhashWithRetries } from "../util/get-blockhash-with-retries";
import { sliceIntoChunks } from "../util/slice-into-chunks";
import { parseAddresses } from "../util/parse-addresses";
import { useModal } from "../contexts/ModalProvider";
import { LinkIcon } from "../components/icons";
import { useBalance } from "../contexts/BalanceProvider";
import { toast } from "react-toastify";

export default function Snedmaster() {
  const [loading, setLoading] = useState(false);
  const { connection } = useConnection();
  const { setModalState } = useModal();
  const { solBalance } = useBalance();
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const { publicKey, connected, signAllTransactions } = useWallet();
  const pubkeyString = useMemo(() => publicKey?.toBase58(), [publicKey]);

  const mint = useCallback(
    async ({ amount, ids = "" }: { amount: string; ids: string }) => {
      try {
        const addresses = parseAddresses(ids);
        const amt = parseFloat(amount);

        if (isNaN(amt)) {
          alert("Invalid amount!");
          return;
        }

        if (
          !confirm(`This send a total of ${(amt * addresses.length).toFixed(
            4
          )} SOL to ${addresses.length} addresses. 
        Proceed?`)
        ) {
          return;
        }

        setLoading(true);

        if (!isSnackbarOpen) {
          toast("snedsnedsned", {
            autoClose: 2000,
            toastId: 'sned'
          });
          setIsSnackbarOpen(true);
        }

        const getTransferIxs = ({
          amount,
          destination,
        }: {
          amount: number;
          destination: string;
        }) => {
          const ixs = [
            SystemProgram.transfer({
              lamports: Math.round(amount * LAMPORTS_PER_SOL),
              toPubkey: toPublicKey(destination),
              fromPubkey: publicKey,
            }),
            new TransactionInstruction({
              keys: [{ pubkey: publicKey, isSigner: true, isWritable: true }],
              data: Buffer.from(`Sent over cryptostraps.tools`, "utf-8"),
              programId: MEMO_ID,
            }),
          ];

          return { ixs, destination, amount };
        };

        const reduced = (addresses as string[])
          .reduce((acc, curr) => {
            const found = acc.find((a) => a.destination === curr);
            if (found) {
              found.amount += amt;
            } else {
              acc.push({ amount: amt, destination: curr });
            }
            return acc;
          }, [])
          .map(getTransferIxs);
        const txs = [];
        const sigs = [];

        for (const slice of sliceIntoChunks(reduced, 5)) {
          const tx = new Transaction();
          const ixs = [...slice.map((s) => s.ixs).flat()];
          tx.add(...ixs);
          tx.feePayer = publicKey;
          tx.recentBlockhash = (
            await getBlockhashWithRetries(connection)
          ).blockhash;
          txs.push(tx);
        }

        await signAllTransactions(txs);

        let counter = 1;

        for (const tx of txs) {
          try {
            const sig = await connection
              .sendRawTransaction(tx.serialize())
              .catch((e) => {
                console.log(e);
                return "failed";
              });

            await connection.confirmTransaction(sig, "confirmed");
            sigs.push({
              txId: sig,
              amount: tx.amount,
              destination: tx.destination,
            });
            counter++;
          } catch (e) {
            console.error(e);
          }
        }
        const filename = `Airdrop-${Date.now()}.json`;
        download(filename, jsonFormat(sigs));
        setModalState({
          message: `Succesfully downloaded ${filename}`,
          open: true,
        });
      } catch (e) {
        console.error(e);
        toast('"An error occured!', {
          type: 'error',
          autoClose: 5000
        })
        setLoading(false);
      }
    },
    [connection, isSnackbarOpen, setModalState, publicKey, signAllTransactions]
  );

  const clipboardNotification = () =>
    toast("Copied to clipboard!", {
      autoClose: 2000,
    });
  return (
    <>
      <div className="mb-3 w-full max-w-full text-center">
        <h1 className="text-3xl text-white">Snedmaster 9000</h1>
        <hr className="my-4 opacity-10" />
      </div>
      <p className="px-2 text-center">
        This tool sends out a certain amount of Solana to different addresses.
        <br />
        <strong>Warning</strong>: always check the json for errors!
      </p>
      <hr className="my-4 opacity-10" />

      <div className={`grid grid-cols-1 gap-4`}>
        <div className="card bg-primary">
          <div className="p-4 card-body">
            <div className="flex flex-row gap-5 items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/solana-logo.jpeg"
                className="w-14 h-14 rounded-full"
                width="56"
                height="56"
                alt="Solana"
              />
              {connected ? (
                <div>
                  Address:
                  <CopyToClipboard
                    text={pubkeyString}
                    onCopy={clipboardNotification}
                  >
                    <span className={`ml-1 cursor-pointer`}>
                      {pubkeyString}
                    </span>
                  </CopyToClipboard>
                  <p>Balance: {solBalance}</p>
                </div>
              ) : (
                <>
                  <WalletMultiButton />
                  {!connected && (
                    <h2 className="text-2xl">Please log into wallet!</h2>
                  )}
                </>
              )}

              <div className="ml-auto">
                <div className="btn-group">
                  {connected && (
                    <a
                      className="btn btn-circle btn-sm"
                      rel="noopener noreferrer"
                      target="_blank"
                      href={`https://solanabeach.io/address/${pubkeyString}`}
                    >
                      <LinkIcon width={16} height={16} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr className="my-4 opacity-10" />
      {connected && <IdField sned={(e) => mint(e)} loading={loading} />}
    </>
  );
}
