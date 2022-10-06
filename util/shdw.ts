import { ShdwDrive } from "@shadow-drive/sdk";
import { sleep } from "./sleep";
export const sortStorageAccounts = (a, b) =>
  b.account.creationTime - a.account.creationTime;

export const getAccounts = async (shdw: ShdwDrive) => {
  const v1Accounts = (await shdw.getStorageAccounts("v1")).map((acc) => ({
    ...acc,
    version: "v1",
  }));
  const v2Accounts = (await shdw.getStorageAccounts("v2")).map((acc) => ({
    ...acc,
    version: "v2",
  }));
  const combined = [...v1Accounts, ...v2Accounts]
    .flat()
    .sort(sortStorageAccounts);
  const result = [];
  for (const account of combined) {
    const fd = new FormData();
    fd.append("storage_account", account.publicKey.toBase58());
    result.push(
      await fetch(
        `https://shadow-storage.genesysgo.net/storage-account-info?storage_account=${account.publicKey.toBase58()}`,
        {
          method: "post",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            storage_account: account.publicKey.toBase58(),
          }),
        }
      ).then((res) => res.json()).then(res => ({...res, ...account}))
    );
    await sleep(100);
  }

  return result
};

export const isValidUnit = (str: string) => {
  const num = parseFloat(str);
  if (isNaN(num)) {
    return false;
  }
  const unit = str.split(`${num}`)[1].toUpperCase();
  if (!["MB", "KB", "GB"].includes(unit)) {
    return false;
  }
  return true;
};
