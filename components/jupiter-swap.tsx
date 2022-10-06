/* eslint-disable react/display-name */
import React, {
  FunctionComponent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TokenInfo } from "@solana/spl-token-registry";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import {
  JupiterProvider,
  TOKEN_LIST_URL,
  useJupiter,
} from "@jup-ag/react-hook";

const preferred = [
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
];

//import FeeInfo from "./FeeInfo";
import fetch from "cross-fetch";
import { toast } from "react-toastify";
import { useBalance } from "../contexts/BalanceProvider";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import useOnClickOutside from "../hooks/use-click-outside";
import { getPlatformFeeAccounts, Jupiter, RouteInfo } from "@jup-ag/core";
import { toPublicKey } from "../util/to-publickey";
import { PublicKey } from "@solana/web3.js";

const defaultProps = {
  styles: {
    primaryBackground: "#0E0D11",
    secondaryBackground: "#131318",
    stroke: "#51576B",
    primaryText: "#fff",
    accent: "#3f52ff",
  },
};

interface IJupiterFormProps {
  styles?: {
    primaryBackground: string;
    secondaryBackground: string;
    stroke: string;
    primaryText: string;
    accent: string;
  };
}

type UseJupiterProps = Parameters<typeof useJupiter>[0];

const SECOND_TO_REFRESH = 30;
const exp = new RegExp("", "i");
const JupiterForm: FunctionComponent<IJupiterFormProps> = ({}) => {
  const ref = useRef();
  const wallet = useWallet();
  const { publicKey } = wallet;
  const [tokenMap, setTokenMap] = useState<Map<string, TokenInfo>>(new Map());
  const [focussed, setFocussed] = useState(false);
  const { fetchBalances, usdcBalanceAsNumber, solBalanceAsNumber } =
    useBalance();

  const [searchQuery, setSearchQuery] = useState("");

  const [formValue, setFormValue] = useState<UseJupiterProps>({
    amount: 0.1,
    inputMint: toPublicKey("So11111111111111111111111111111111111111112"),
    outputMint: toPublicKey("SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y"),
    slippage: 5, // 0.5%
  });

  const [inputTokenInfo, outputTokenInfo] = useMemo(() => {
    return [
      tokenMap.get(formValue.inputMint?.toBase58() || ""),
      tokenMap.get(formValue.outputMint?.toBase58() || ""),
    ];
  }, [formValue.inputMint, formValue.outputMint, tokenMap]);

  useEffect(() => {
    fetch(TOKEN_LIST_URL["mainnet-beta"])
      .then((res) => res.json())
      .then((tokens: TokenInfo[]) => {
        setTokenMap(
          tokens.reduce((map, item) => {
            map.set(item.address, item);
            return map;
          }, new Map())
        );
      });
  }, [setTokenMap]);

  const amountInDecimal = useMemo(() => {
    return formValue.amount * 10 ** (inputTokenInfo?.decimals || 1);
  }, [inputTokenInfo, formValue.amount]);

  const allTokenMints = useMemo(
    () => Array.from(tokenMap.values()).map((entry) => entry.address),
    [tokenMap]
  );

  const filteredTokens = useMemo(
    () =>
      searchQuery
        ? Array.from(tokenMap.values())
            .filter(
              (item) =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.symbol.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((entry) => entry.address)
            .sort((token) => (preferred.includes(token) ? 1 : -1))
        : allTokenMints,
    [allTokenMints, searchQuery, tokenMap]
  );

  const sortedFilteredItems = useMemo(() => {
    return [
      ...preferred.map((p) => filteredTokens.find((tok) => tok === p)),
      ...filteredTokens.filter((p) => !preferred.includes(p)),
    ];
  }, [filteredTokens]);

  const {
    routeMap,
    routes,
    loading,
    exchange,
    //error,
    refresh,
    lastRefreshTimestamp,
  } = useJupiter({
    ...formValue,
    amount: amountInDecimal,
  });

  // ensure outputMint can be swapable to inputMint
  useEffect(() => {
    if (formValue.inputMint && routeMap) {
      const possibleOutputs = routeMap.get(formValue.inputMint.toBase58());
      if (
        possibleOutputs &&
        !possibleOutputs?.includes(formValue.outputMint?.toBase58() || "")
      ) {
        setFormValue((val) => ({
          ...val,
          outputMint: toPublicKey(possibleOutputs[0]),
        }));
      }
    }
  }, [formValue.inputMint, formValue.outputMint, routeMap]);

  useOnClickOutside(ref, (e) => {
    if (!e.target.isEqualNode(document.getElementById("inputMint"))) {
      setFocussed(false);
    }
  });

  const tokenListTempl = useMemo(
    () =>
      sortedFilteredItems
        .filter((o) => exp.test(o) && tokenMap.get(o)?.symbol)
        .map((opt) => {
          const value = tokenMap.get(opt);
          return (
            <li
              className="px-3 py-2 cursor-pointer hover:bg-slate-700"
              key={opt}
              value={value?.address}
              onClick={() => {
                setFormValue({
                  ...formValue,
                  inputMint: toPublicKey(value.address),
                });
                (
                  document.getElementById("inputMint") as HTMLInputElement
                ).value = value.symbol;
                setFocussed(false);
              }}
            >
              <div
                className="grid items-center"
                style={{ gridTemplateColumns: "32px auto" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value.logoURI}
                  alt={""}
                  className="w-5 h-5"
                  loading="lazy"
                />
                <span>{value?.symbol}</span>
              </div>
            </li>
          );
        }),
    [formValue, sortedFilteredItems, tokenMap]
  );

  return (
    <div className="overflow-y-auto mx-auto my-6 max-w-md ring ring-primary card">
      <div className="card-body">
        <div className="grid grid-cols-1">
          <div className="relative z-20 w-full form-control">
            <span className="mb-3 label-text">You pay</span>
            <label className="relative z-20 w-full input-group">
              <button className="flex justify-center items-center px-6 input">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tokenMap.get(formValue.inputMint.toBase58())?.logoURI}
                  alt={""}
                  className="absolute z-10 w-5 h-5 rounded-full"
                />
              </button>
              <input
                id="inputMint"
                className={`flex-1 border select rounded-none ${
                  focussed && "rounded-bl-none"
                }`}
                onChange={(e) => {
                  if (!focussed) {
                    setFocussed(true);
                  }
                  setSearchQuery(e.target.value);
                }}
                name="inputMint"
                defaultValue={
                  tokenMap.get(formValue.inputMint.toBase58())?.symbol
                }
                onFocus={() => setFocussed(true)}
              />
              <input
                type={"number"}
                name="amount"
                className={`flex-1 input`}
                id="amount"
                placeholder="0"
                max={
                  formValue.inputMint.toBase58() === allTokenMints[0]
                    ? solBalanceAsNumber
                    : usdcBalanceAsNumber
                }
                style={{ height: "100%" }}
                defaultValue={formValue.amount}
                onInput={(e: any) => {
                  let newValue = Number(e.target?.value || 0);
                  newValue = Number.isNaN(newValue) ? 0 : newValue;
                  setFormValue((val) => ({
                    ...val,
                    amount: Math.max(newValue, 0),
                  }));
                }}
              />
            </label>
          </div>
          <div
            className="relative z-10"
            style={{ transform: "translateY(-0.5rem)" }}
          >
            <div className="absolute bottom-0 w-2/3">
              {focussed && (
                <ul
                  ref={ref}
                  className="overflow-y-auto absolute top-0 right-0 left-3 pt-4 bg-gray-800 rounded-b-lg border-r border-b border-l shadow-lg border-slate-500"
                  style={{ maxHeight: 250 }}
                >
                  {tokenListTempl}
                </ul>
              )}
            </div>
          </div>
          <div className="mt-3 form-control">
            <span className="mb-3 label-text">You get</span>
            <div className="input-group">
              <input
                disabled
                id="outputMint"
                className="flex-1 border border-r-0 input border-success disabled"
                name="outputMint"
                defaultValue={"SHDW"}
              />
              <input
                type={"text"}
                className="flex-1 border border-l-0 input border-success disabled"
                name="outAmount"
                id="outAmount"
                placeholder="0"
                disabled
                style={{ height: "100%" }}
                value={
                  routes?.length
                    ? routes[0]?.outAmount /
                      10 ** (outputTokenInfo?.decimals || 1)
                    : 0
                }
              />
            </div>
          </div>

          <div className="flex flex-col mt-3">
            {!!routes?.length && (
              <span className="my-3">Best route out of {routes?.length}:</span>
            )}
            {!routes?.length && !loading && (
              <span className="my-3 w-full badge badge-error">
                No routes found!
              </span>
            )}
            {/* {routes?.[0] &&
              (() => {
                const route = routes[0];
                return (
                  <div
                    className="flex flex-row p-3 border border-primary"
                    style={{
                      marginBottom: 10,
                      borderRadius: "1rem",
                    }}
                  >
                    <div className="flex flex-col">
                      <span>
                        {route.marketInfos
                          .map((info) => info.amm.label)
                          .join(" -> ")}
                      </span>
                      <span>
                        {route.marketInfos
                          .map(
                            (info) =>
                              `${
                                tokenMap.get(info?.inputMint.toString())?.symbol
                              } -> ${
                                tokenMap.get(info?.outputMint.toString())
                                  ?.symbol
                              }`
                          )
                          .join(" -> ")}
                      </span>
                    </div>
                  </div>
                );
              })()} */}
          </div>

          <div className="flex justify-center items-center mt-3">
            {!publicKey && <WalletMultiButton />}
          </div>
          {!!publicKey && (
            <div className="flex justify-center items-center">
              <button
                type="button"
                className={`w-full btn btn-outline btn-success ${
                  loading && "loading"
                }`}
                disabled={loading || !wallet?.publicKey || !routes?.length}
                onClick={async () => {
                  try {
                    if (
                      !loading &&
                      routes?.length &&
                      wallet.signAllTransactions &&
                      wallet.signTransaction &&
                      wallet.sendTransaction &&
                      wallet.publicKey
                    ) {
                      const swapResult = await exchange({
                        routeInfo: routes[0],
                        wallet,
                      });
                      console.log({ swapResult });

                      if ("error" in swapResult) {
                        console.log("Error:", swapResult.error);
                      } else if ("txid" in swapResult) {
                        toast.dismiss();
                        toast("Success!", {
                          autoClose: 3000,
                        });
                        fetchBalances();
                        console.log("Sucess:", swapResult.txid);
                        console.log("Input:", swapResult.inputAmount);
                        console.log("Output:", swapResult.outputAmount);
                      }
                    }
                  } catch (e) {
                    console.error(e);
                    toast("An error occurred!", {
                      autoClose: 3000,
                      type: "error",
                    });
                  }
                }}
              >
                Swap best route
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

JupiterForm.defaultProps = defaultProps;

const Wrapper = () => {
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
    <JupiterProvider
      connection={connection}
      cluster="mainnet-beta"
      userPublicKey={publicKey}
      platformFeeAndAccounts={platformFeeAndAccounts}
    >
      <JupiterForm />
    </JupiterProvider>
  );
};

export default Wrapper;
