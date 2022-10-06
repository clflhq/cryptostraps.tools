import { Connection } from "@solana/web3.js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const INTERVAL_TIMEOUT = process.env.NEXT_TPS_TIMEOUT
  ? +process.env.NEXT_TPS_TIMEOUT
  : 60000;
const MIN_TPS = process.env.NEXT_MIN_TPS ? +process.env.NEXT_MIN_TPS : 1500;

const PerformanceContext = createContext({
  warning: "",
  tps: 0,
});

export const usePerformance = () => useContext(PerformanceContext);
export function PerformanceProvider({ children }) {
  const [warning, setWarning] = useState<string>("");
  const [tps, setTps] = useState(0);
  // hack: https://github.com/solana-labs/solana/issues/26372
  const connection = useMemo(() => new Connection("https://alice.genesysgo.net"), []);


  const getPerformance = useCallback(async () => {
    const performance = (
      await connection.getRecentPerformanceSamples(5)
    ).reduce((acc, curr) => {
      const tps = curr.numTransactions / curr.samplePeriodSecs;
      acc.push(tps);
      return acc;
    }, []);

    const _tps = performance.reduce((a, b) => a + b, 0) / performance.length;
    setTps(_tps);
    setWarning(
      _tps < MIN_TPS
        ? `Solanas TPS are lower than 1500 (${Math.round(
          _tps
        )}). Network peformance might be degraded and transactions might fail.`
        : ""
    );
  }, [connection]);

  useEffect(() => {
    (async () => {
      await getPerformance();
      const iv = setInterval(async () => {
        await getPerformance();
      }, INTERVAL_TIMEOUT);
      return () => clearInterval(iv);
    })();
  }, [connection, getPerformance]);

  return (
    <PerformanceContext.Provider value={{ warning, tps }}>
      {warning && (
        <div className="fixed right-0 bottom-0 left-0 z-50 p-1 text-center text-white bg-red-800 lg:left-64 lg:bottom-auto lg:top-0">
          {warning}
        </div>
      )}
      {children}
    </PerformanceContext.Provider>
  );
}
