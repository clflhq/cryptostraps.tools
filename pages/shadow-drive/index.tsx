import React, { useCallback, useEffect, useReducer, useState } from "react";
import { useForm } from "react-hook-form";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import Head from "next/head";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ShdwDrive } from "@shadow-drive/sdk";
import { StorageAccount } from "@shadow-drive/sdk/dist/types";
import { PublicKey } from "@solana/web3.js";

import { sizeMB } from "../../components/file-tile";
import { ImageURI } from "../../util/image-uri";
import { useBalance } from "../../contexts/BalanceProvider";
import { toast } from "react-toastify";
import Link from "next/link";
import { TrashIcon } from "../../components/icons";
import { getAccounts, isValidUnit, sortStorageAccounts } from "../../util/shdw";

import JupiterForm from "../../components/jupiter-swap";

function ShdwDrivePage() {
  const initState: {
    isResizing: string;
    increaseOrDecrease: "increase" | "decrease";
    uploadInProgress: boolean;
    createStorageLoading: boolean;
    shdwDrive: ShdwDrive;
    storageAccounts: { account: StorageAccount; publicKey: PublicKey }[];
    buttonsLoading: Record<string, boolean>;
    isCreatingStorageAccount: boolean;
    loading: boolean;
  } = {
    isResizing: "",
    uploadInProgress: false,
    increaseOrDecrease: "increase",
    createStorageLoading: false,
    shdwDrive: null,
    storageAccounts: [],
    buttonsLoading: {},
    isCreatingStorageAccount: false,
    loading: true,
  };
  const [state, dispatch] = useReducer(
    (
      state: typeof initState,
      action:
        | {
            type: "increaseOrDecrease";
            payload?: { increaseOrDecrease: "increase" | "decrease" };
          }
        | { type: "isResizing"; payload?: { isResizing: string } }
        | { type: "loading"; payload?: { loading: boolean } }
        | { type: "uploadInProgress"; payload?: { uploadInProgress: boolean } }
        | {
            type: "createStorageLoading";
            payload?: { createStorageLoading: boolean };
          }
        | { type: "shdwDrive"; payload?: { shdwDrive: ShdwDrive } }
        | {
            type: "isCreatingStorageAccount";
            payload?: { isCreatingStorageAccount: boolean };
          }
        | {
            type: "storageAccounts";
            payload?: {
              storageAccounts: {
                account: StorageAccount;
                publicKey: PublicKey;
              }[];
            };
          }
        | {
            type: "buttonsLoading";
            payload?: { buttonsLoading: Record<string, boolean> };
          }
    ) => {
      switch (action.type) {
        case "loading":
          return { ...state, loading: action.payload.loading };
        case "isResizing":
          return { ...state, isResizing: action.payload.isResizing };
        case "increaseOrDecrease":
          return {
            ...state,
            increaseOrDecrease: action.payload.increaseOrDecrease,
          };
        case "uploadInProgress":
          return {
            ...state,
            uploadInProgress: action.payload.uploadInProgress,
          };
        case "storageAccounts":
          return { ...state, storageAccounts: action.payload.storageAccounts };
        case "shdwDrive":
          return { ...state, shdwDrive: action.payload.shdwDrive };
        case "isCreatingStorageAccount":
          return {
            ...state,
            isCreatingStorageAccount: action.payload.isCreatingStorageAccount,
          };
        case "createStorageLoading":
          return {
            ...state,
            createStorageLoading: action.payload.createStorageLoading,
          };
        case "buttonsLoading":
          return { ...state, buttonsLoading: action.payload.buttonsLoading };

        default: {
          throw new Error(
            "unsupported action type given on SHDW Drive reducer"
          );
        }
      }
    },
    initState
  );
  const { register, handleSubmit, getValues, reset } = useForm();
  const { connection } = useConnection();
  const wallet = useWallet();
  const { solBalance, shdwBalance } = useBalance();
  const [showingForm, setShowingForm] = useState(false);
  const { publicKey } = wallet;

  useEffect(() => {
    (async () => {
      if (wallet?.publicKey) {
        const shdwDrive = await new ShdwDrive(connection, wallet).init();
        dispatch({
          type: "shdwDrive",
          payload: { shdwDrive },
        });
        const storageAccounts = await getAccounts(shdwDrive);
        dispatch({
          type: "storageAccounts",
          payload: {
            storageAccounts: storageAccounts,
          },
        });

        dispatch({ type: "loading", payload: { loading: false } });
      }
    })();
  }, [wallet?.publicKey, connection, wallet]);

  const onSubmit = handleSubmit(
    async ({ storageAccountName, storageAccountSize }) => {
      if (!storageAccountName || !isValidUnit(storageAccountSize)) {
        return;
      }
      dispatch({
        type: "createStorageLoading",
        payload: { createStorageLoading: true },
      });

      const id = toast(
        ` Storage Account &quot;${storageAccountName}&quot; is being created...`
      );
      try {
        const response = await state.shdwDrive.createStorageAccount(
          storageAccountName,
          storageAccountSize,
          "v2"
        );
        toast.dismiss(id);
        toast("Storage account created at " + response.shdw_bucket, {
          autoClose: 3000,
          type: "success",
        });
        reset();
        dispatch({
          type: "isCreatingStorageAccount",
          payload: { isCreatingStorageAccount: false },
        });
        setTimeout(async () => {
          const storageAccounts = await getAccounts(state.shdwDrive);
          dispatch({
            type: "storageAccounts",
            payload: {
              storageAccounts: storageAccounts.sort(sortStorageAccounts) as {
                account: StorageAccount;
                publicKey: PublicKey;
              }[],
            },
          });
        }, 2000);
      } catch (e) {
        toast.dismiss();
        toast("An error occured. Check Console for more info!", {
          autoClose: 3000,
          type: "error",
        });
      }
    }
  );
  const handleDeleteStorageAccount = async ({ publicKey, pubKeyString, i }) => {
    const acc = state.storageAccounts.find((account) =>
      account.publicKey.equals(publicKey)
    );
    dispatch({
      type: "buttonsLoading",
      payload: {
        buttonsLoading: {
          ...state.buttonsLoading,
          [pubKeyString]: true,
        },
      },
    });
    try {
      const response = await state.shdwDrive.deleteStorageAccount(
        publicKey,
        (acc as any).version
      );
      if (response.txid) {
        toast("Storage Account is marked for deletion", {
          autoClose: 3000,
        });
        const updatedArr = [...state.storageAccounts];
        updatedArr[i].account.deleteRequestEpoch =
          (await connection.getEpochInfo()).epoch + 1;

        dispatch({
          type: "storageAccounts",
          payload: {
            storageAccounts: updatedArr.sort(sortStorageAccounts),
          },
        });
      }
    } catch (e) {
      toast("An error occured! Check console for more info.", {
        type: "error",
      });
      console.log(e);
    }
    dispatch({
      type: "buttonsLoading",
      payload: {
        buttonsLoading: {
          ...state.buttonsLoading,
          [pubKeyString]: false,
        },
      },
    });
  };

  const handleCancelDeleteStorageAccountRequest = async ({
    publicKey,
    pubKeyString,
    i,
  }) => {
    const acc = state.storageAccounts.find((account) =>
      account.publicKey.equals(publicKey)
    );

    dispatch({
      type: "buttonsLoading",
      payload: {
        buttonsLoading: {
          ...state.buttonsLoading,
          [pubKeyString]: true,
        },
      },
    });
    try {
      const response = await state.shdwDrive.cancelDeleteStorageAccount(
        publicKey,
        (acc as any).version
      );

      toast("Storage Account deletion request will be cancelled", {
        autoClose: 3000,
      });

      const updatedArr = [...state.storageAccounts];
      updatedArr[i].account.deleteRequestEpoch = 0;

      dispatch({
        type: "storageAccounts",
        payload: {
          storageAccounts: updatedArr.sort(sortStorageAccounts),
        },
      });
    } catch (e) {
      toast("An error occured. Check Console for more info!", {
        autoClose: 3000,
        type: "error",
      });
      console.log(e);
    }

    dispatch({
      type: "buttonsLoading",
      payload: {
        buttonsLoading: {
          ...state.buttonsLoading,
          [pubKeyString]: false,
        },
      },
    });
  };

  const onStorageSizeSubmit = async ({ size, unit, publicKey }) => {
    const acc = state.storageAccounts.find((account) =>
      account.publicKey.equals(publicKey)
    );
    const finalStr = `${size}${unit}`;
    try {
      toast(`Sending and confirming transaction...`, {
        isLoading: true,
      });
      if (state.increaseOrDecrease === "decrease") {
        await state.shdwDrive.reduceStorage(
          publicKey,
          finalStr,
          (acc as any).version
        );
        toast.dismiss();
        toast(`Storage succssfully decreased by ${finalStr}!`, {
          autoClose: 3000,
          type: "success",
        });
      }
      if (state.increaseOrDecrease === "increase") {
        await state.shdwDrive.addStorage(
          publicKey,
          finalStr,
          (acc as any).version
        );
        toast.dismiss();
        toast(`Storage succssfully increased by ${finalStr}!`, {
          autoClose: 3000,
          type: "success",
        });
      }
    } catch (e) {
      toast.dismiss();
      toast("An error occured. Check Console for more info!", {
        type: "error",
      });
      console.error(e);
    }
  };

  const handleResize = useCallback(
    (pubKeyString: string) =>
      dispatch({
        type: "isResizing",
        payload: {
          isResizing: state.isResizing === pubKeyString ? "" : pubKeyString,
        },
      }),
    [state.isResizing]
  );

 

  return (
    <>
      <Head>
        <title>🛠️ Cryptostraps Tools - SHDW Drive</title>
      </Head>
      <div className="mb-3 max-w-full text-center">
        <h1 className="text-2xl text-white lg:text-4xl">
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
          SHDW Drive Console
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
        <button
          className="mt-3 btn btn-success btn-outline btn-sm"
          onClick={() => setShowingForm(!showingForm)}
        >
          {showingForm ? "Close Swap" : "Get $SHDW"}
        </button>
        <hr className="my-4 opacity-10" />
      </div>
      <div>
        {wallet.connected && !!state.loading && (
          <div className="w-full text-center">
            {" "}
            <button className="mx-auto btn btn-ghost loading"></button>
          </div>
        )}
        {!wallet.connected && (
          <div className="flex justify-center items-center w-full">
            <WalletMultiButton />
          </div>
        )}

        {showingForm && (
          <div className="my-3">
            <JupiterForm />
          </div>
        )}

        {wallet.connected && !state.loading && (
          <>
            <div className="p-6 max-w-full bg-gray-900 card">
              {!state.storageAccounts.length &&
                !state.isCreatingStorageAccount && (
                  <div>No storage accounts yet.</div>
                )}

              <ul>
                <li>
                  <div className="flex mb-4">
                    {state.isCreatingStorageAccount && (
                      <form
                        className="grid grid-cols-2 gap-4 mb-4"
                        onSubmit={onSubmit}
                      >
                        <input
                          type="text"
                          {...register("storageAccountName")}
                          className="w-60 input"
                          placeholder="Name"
                        />
                        <input
                          type="text"
                          {...register("storageAccountSize")}
                          className="w-60 input"
                          placeholder="Size (in kb, mb or gb, e.g. 10mb)"
                        />
                      </form>
                    )}
                    <div></div>

                    <div className="flex flex-1 gap-3 justify-end">
                      {state.isCreatingStorageAccount && (
                        <input
                          className="w-24 btn btn-success btn-sm btn-outline"
                          type="submit"
                          value={"Add"}
                          disabled={state.createStorageLoading}
                          onClick={() => {
                            onSubmit(getValues() as any);
                          }}
                        />
                      )}
                      <button
                        className={`btn btn-primary btn-sm ${
                          state.isCreatingStorageAccount ? "w-24" : ""
                        }`}
                        onClick={async () => {
                          dispatch({
                            type: "isCreatingStorageAccount",
                            payload: {
                              isCreatingStorageAccount:
                                !state.isCreatingStorageAccount,
                            },
                          });
                        }}
                        disabled={state.createStorageLoading}
                      >
                        {state.isCreatingStorageAccount
                          ? "Cancel"
                          : "Add new Storage Account"}
                      </button>
                    </div>
                  </div>
                </li>
                {state.storageAccounts.map(
                  (
                    {
                      account,
                      publicKey,
                      current_usage,
                      reserved_bytes,
                    }: {
                      account: StorageAccount;
                      publicKey: PublicKey;
                      current_usage: number;
                      reserved_bytes: number;
                    },
                    i
                  ) => {
                    const pubKeyString = publicKey.toBase58();

                    return (
                      <li id={pubKeyString} key={pubKeyString}>
                        <div className="flex flex-row justify-between items-center w-full">
                          <div className="flex flex-row gap-6 w-full">
                            <div className="w-full">
                              <span
                                className={`${
                                  !!account.deleteRequestEpoch
                                    ? "text-red-500"
                                    : ""
                                } flex flex-row`}
                              >
                                {" "}
                                <strong>{account.identifier}</strong>
                              </span>

                              {!!account.deleteRequestEpoch && (
                                <span className="text-red-500">
                                  {" "}
                                  - Will be deleted after epoch{" "}
                                  {account.deleteRequestEpoch}!
                                </span>
                              )}
                              <span className="my-2">
                                Created:{" "}
                                {new Date(
                                  account.creationTime * 1000
                                ).toLocaleString()}
                              </span>
                              <br />

                              <a
                                href={`https://solscan.io/account/${pubKeyString}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {pubKeyString}
                              </a>
                              <br />
                              <div className="flex flex-wrap w-full">
                                <a
                                  target="_blank"
                                  href={`/shadow-drive/files?storageAccount=${pubKeyString}`}
                                  rel="noopener noreferrer"
                                >
                                  <button className="my-2 btn btn-sm btn-primary">
                                    See files
                                  </button>
                                </a>
                                <Link
                                  href={{
                                    pathname: "/shadow-drive/sned",
                                    query: { storageAccount: pubKeyString },
                                  }}
                                  passHref
                                >
                                  <a>
                                    <button
                                      className={`m-2 btn btn-sm btn-primary`}
                                    >
                                      Upload files
                                    </button>
                                  </a>
                                </Link>

                                <button
                                  className={`btn btn-primary btn-sm my-2 ${
                                    state.isResizing === pubKeyString
                                      ? "btn-outline"
                                      : ""
                                  }`}
                                  onClick={() => handleResize(pubKeyString)}
                                >
                                  {state.isResizing !== pubKeyString
                                    ? "Resize"
                                    : "Cancel"}
                                </button>

                                {!account.deleteRequestEpoch && (
                                  <button
                                    className={`btn gap-2 btn-error btn-sm ml-auto w-32 ${
                                      !!state.buttonsLoading[pubKeyString]
                                        ? "loading"
                                        : ""
                                    } `}
                                    onClick={() =>
                                      handleDeleteStorageAccount({
                                        pubKeyString,
                                        publicKey,
                                        i,
                                      })
                                    }
                                  >
                                    {!!state.buttonsLoading[pubKeyString] ? (
                                      ""
                                    ) : (
                                      <>
                                        <TrashIcon width={16} /> delete
                                      </>
                                    )}
                                  </button>
                                )}
                                {!!account.deleteRequestEpoch && (
                                  <button
                                    className={`btn btn-error btn-sm w-32 btn-outline ml-auto ${
                                      state.buttonsLoading[pubKeyString] &&
                                      " loading"
                                    }`}
                                    onClick={() =>
                                      handleCancelDeleteStorageAccountRequest({
                                        pubKeyString,
                                        publicKey,
                                        i,
                                      })
                                    }
                                  >
                                    cancel deletion
                                  </button>
                                )}
                              </div>
                              <div className="badge badge-ghost">
                                Free:{" "}
                                {sizeMB(
                                  +(reserved_bytes - current_usage)?.toFixed(2)
                                ).toFixed(2)}{" "}
                                MB /
                                {sizeMB(
                                  +(reserved_bytes as any)?.toFixed(2)
                                ).toFixed(2)}{" "}
                                MB
                              </div>
                            </div>
                          </div>
                        </div>
                        {state.isResizing === pubKeyString && (
                          <form
                            className="my-3"
                            onSubmit={handleSubmit(({ size, unit }) =>
                              onStorageSizeSubmit({ publicKey, size, unit })
                            )}
                          >
                            <h3 className="mb-2 text-xl">Storage Resize</h3>
                            <div className="flex flex-row gap-3">
                              <div className="btn-group">
                                <button
                                  className={`btn btn-sm ${
                                    state.increaseOrDecrease === "increase"
                                      ? "btn-active"
                                      : ""
                                  }`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    dispatch({
                                      type: "increaseOrDecrease",
                                      payload: {
                                        increaseOrDecrease: "increase",
                                      },
                                    });
                                  }}
                                >
                                  Increase
                                </button>
                                <button
                                  className={`btn btn-sm ${
                                    state.increaseOrDecrease === "decrease"
                                      ? "btn-active"
                                      : ""
                                  }`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    dispatch({
                                      type: "increaseOrDecrease",
                                      payload: {
                                        increaseOrDecrease: "decrease",
                                      },
                                    });
                                  }}
                                >
                                  Decrease
                                </button>
                              </div>
                              <div className="form-control">
                                <label className="input-group input-group-sm">
                                  <input
                                    {...register("size")}
                                    className="input input-sm"
                                    type="number"
                                    min={0}
                                  />
                                  <select
                                    {...register("unit")}
                                    className="select select-sm select-bordered"
                                  >
                                    <option disabled selected>
                                      Pick a unit
                                    </option>
                                    <option>KB</option>
                                    <option>MB</option>
                                    <option>GB</option>
                                  </select>
                                </label>
                              </div>

                              <button
                                className={`btn btn-sm btn-success btn-outline`}
                                type="submit"
                              >
                                Ok
                              </button>
                            </div>
                          </form>
                        )}
                        <progress
                          className="progress progress-primary"
                          value={1 - current_usage / reserved_bytes}
                        ></progress>

                        {i !== state.storageAccounts.length - 1 && (
                          <hr className="my-3 opacity-10" />
                        )}
                      </li>
                    );
                  }
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}
export default ShdwDrivePage;
