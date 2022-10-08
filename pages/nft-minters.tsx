import React, { useCallback, useState, useEffect } from "react";
import { download } from "../util/download";
import jsonFormat from "json-format";
import { useModal } from "../contexts/ModalProvider";
import { useForm } from "react-hook-form";
import { getAddresses, validateSolAddressArray } from "../util/validators";
import { useConnection } from "@solana/wallet-adapter-react";
import { from, mergeMap, tap, toArray } from "rxjs";
import Head from "next/head";
import { toPublicKey } from "../util/to-publickey";
import { toast } from "react-toastify";
import DownloadHistory from "../components/download-history";
import { useRouter } from "next/router";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { parse } from "json2csv";

const COINFRA_TREASURY_WALLET = "G2XnfWq5FKbNFwMVa3z6yyQ7NFyxw7qL359niia84bAZ";

export default function GetHolders() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm();

  const [counter, setCounter] = useState(0);
  const [len, setLen] = useState(0);
  const [loading, setLoading] = useState(false);
  const { setModalState } = useModal();
  const { connection } = useConnection();
  const {
    query: { jobName },
  } = useRouter();
  useEffect(() => setModalState({ open: false, message: "" }), [setModalState]);
  useEffect(() => {
    try {
      const localStorageItems = localStorage.getItem("user-mint-lists");
      if (localStorageItems) {
        const asObj = JSON.parse(localStorageItems);
        const items = asObj.find((obj) => obj.name === jobName)?.items;
        setValue("mints", JSON.stringify(items));
      }
    } catch (e) {
      console.log(e);
    }
  }, [jobName, setValue]);

  const fetchMinters = useCallback(
    async ({ mints }: { mints: string }) => {
      const parsed = getAddresses(mints);
      toast(" Downloading your data.", { isLoading: true });
      setLen(parsed.length);
      setLoading(true);
      let i = 0;
      const mintInfo = [];
      const errors = [];
      const fetchOwner = async (addy: string) => {
        let tx;
        let firstSig;

        let retries = 0;
        while (retries < 5) {
          try {
            tx = await connection.getConfirmedSignaturesForAddress2(toPublicKey(addy));
            firstSig = tx.sort((a, b) => a.blockTime - b.blockTime)[0];
            if (firstSig?.signature) {
              const txContent = await connection.getTransaction(firstSig?.signature);

              if (!txContent) return;

              const mintTxid = txContent.transaction.signatures[0];
              const owner = txContent.meta.postTokenBalances.find(
                (value) => value.mint === addy && value.uiTokenAmount.uiAmountString === "1"
              ).owner;
              const treasuryWalletIndex = txContent.transaction.message.accountKeys.findIndex(
                (accountKey) => accountKey.toString() === COINFRA_TREASURY_WALLET
              );
              const price =
                (txContent.meta.postBalances[treasuryWalletIndex] - txContent.meta.preBalances[treasuryWalletIndex]) /
                LAMPORTS_PER_SOL;
              mintInfo.push({ mint: addy, owner, mintTxid, price, unixTime: txContent.blockTime });
            } else {
              throw new Error("firstSig not found");
            }
            return;
          } catch (e) {
            console.error(e?.message || e);
            errors.push({ address: addy, error: e?.message || e });
            retries++;
          }
        }
      };

      from(parsed)
        .pipe(
          mergeMap(
            (addy) =>
              from(fetchOwner(addy)).pipe(
                tap((res) => {
                  i++;
                  setCounter(i);
                })
              ),
            6
          ),
          toArray()
        )
        .subscribe({
          next: () => {
            const filename = `Minters-${Date.now()}`;
            download(`${filename}.json`, jsonFormat({ mintInfo: [...mintInfo], errors }));
            download(`${filename}.csv`, parse(mintInfo));
            setLoading(false);
            setModalState({
              message: `Succesfully downloaded ${filename}`,
              open: true,
            });
            toast.dismiss();
          },
          error: (err) => {
            toast.dismiss();
          },
        });
    },
    [connection, setModalState]
  );

  return (
    <>
      <Head>
        <title>🛠️ Cryptostraps Tools - 👛 NFT Minters</title>
      </Head>
      <div className="mb-3 w-full max-w-full text-center">
        <h1 className="text-3xl text-white">NFT Minters</h1>
        <hr className="my-4 opacity-10" />
      </div>
      <p className="px-2 text-center">
        This tool gives you a list of first minters for a list of Solana NFTs. This helps you e.g. for airdrops to those
        who initially minted your NFT collection.
      </p>
      <hr className="my-4 opacity-10" />
      <div className="max-w-full bg-gray-900 card">
        <form onSubmit={handleSubmit(fetchMinters)} className={`flex flex-col w-full`}>
          <div className="card-body">
            <label className="justify-center mb-4 label">
              Please enter SOL mint IDs as JSON array to get their minters.
            </label>

            <textarea
              {...register("mints", {
                validate: validateSolAddressArray,
                required: "Field is required",
              })}
              rows={4}
              className={`w-full shadow-lg textarea`}
            />
            {!!errors?.mints?.message && <label className="label text-error">{errors?.mints?.message}</label>}
            <div className="flex flex-col gap-3 justify-center items-center mt-6 text-center">
              {loading && (
                <div className="w-60">
                  <span>{((counter / len) * 100).toFixed(2)}%</span>
                  <progress
                    className="border progress progress-primary border-slate-700"
                    value={(counter / len) * 100}
                    max={100}
                  ></progress>
                </div>
              )}
              <button
                type="submit"
                disabled={!!errors?.mints}
                className={`btn btn-primary rounded-box shadow-lg ${loading ? "loading" : ""}`}
              >
                Get Minters
              </button>
            </div>
          </div>
        </form>

        {/* {!!localStorageItems?.length && (
          <DownloadHistory
            localstorageId="nft-minters"
            localStorageItems={localStorageItems}
            setLocalStorageItems={setLocalStorageItems}
          />
        )} */}
      </div>
    </>
  );
}
