import React, { useCallback, useEffect, useState } from "react";
import jsonFormat from "json-format";
import { useForm } from "react-hook-form";
import Head from "next/head";
import { useConnection } from "@solana/wallet-adapter-react";

import { getAddresses, validateSolAddressArray } from "../util/validators";
import { useModal } from "../contexts/ModalProvider";
import { getOwners } from "../util/holder-snapshot";
import { download } from "../util/download";
import { toast } from "react-toastify";
import DownloadHistory from "../components/download-history";
import { useRouter } from "next/router";
import { parse } from "json2csv";

export default function HolderSnapshot() {
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
  const [localStorageItems, setLocalStorageItems] = useState<{ name: string; timestamp: number; items: any[] }[]>([]);
  const {
    query: { jobName },
  } = useRouter();
  useEffect(() => setModalState({ open: false, message: "" }), [setModalState]);
  useEffect(() => {
    try {
      debugger;
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
  const fetchHolders = useCallback(
    async ({ mints }: { mints: string }) => {
      try {
        const parsed = getAddresses(mints);
        toast(`Downloading your data.`, { isLoading: true });
        setLen(parsed.length);
        setLoading(true);

        const owners = await getOwners(parsed, connection, setCounter).catch(() => {
          setModalState({ open: true, message: "An error occured!" });
          setLoading(false);
        });

        const filename = `Holders-${Date.now()}`;
        download(`${filename}.json`, jsonFormat(owners, { size: 1, type: "tab" }));
        download(
          `${filename}-with-amount.csv`,
          parse(Object.keys(owners as any).map((key) => ({ owner: key, amount: owners[key].amount })))
        );
        download(
          `${filename}-per-mint.csv`,
          parse(Object.keys(owners as any).flatMap((key) => owners[key].mints.map((mint) => ({ mint, owner: key }))))
        );
        setLoading(false);
        setModalState({
          message: `Successfully downloaded ${filename}`,
          open: true,
        });
        toast.dismiss();
      } catch (e) {
        toast("An error occured!", { autoClose: 3000, type: "error" });
        console.error(e);
        toast.dismiss();
      }
    },
    [setModalState, connection]
  );

  return (
    <>
      <Head>
        <title>🛠️ Cryptostraps Tools - 📷 NFT Holders</title>
      </Head>
      <div className="mb-3 w-full max-w-full text-center">
        <h1 className="text-3xl text-white">Holder Snapshot</h1>
        <hr className="my-4 opacity-10" />
      </div>
      <p className="px-2 text-center">
        This tool gives you a snapshot of holders from Solana Mint IDs. It will return an object with holders, mints and
        amounts.
        <br />
        <strong>Designed to work with NFTs only</strong>
      </p>
      <hr className="my-4 opacity-10" />
      <div className="max-w-full bg-gray-900 card">
        <form onSubmit={handleSubmit(fetchHolders)} className={`flex flex-col w-full`}>
          <div className="card-body">
            <label className="justify-center mb-4 label">
              Please enter SOL mint IDs as JSON array to get their holders.
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
              <div>
                <button
                  type="submit"
                  disabled={!!errors?.mints}
                  className={`btn btn-primary rounded-box shadow-lg ${loading ? "loading" : ""}`}
                >
                  Get Holders
                </button>
              </div>
            </div>
          </div>
        </form>

        {!!localStorageItems?.length && (
          <DownloadHistory
            localstorageId="nft-holders"
            localStorageItems={localStorageItems}
            setLocalStorageItems={setLocalStorageItems}
          />
        )}
      </div>
    </>
  );
}
