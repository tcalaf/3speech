export function getMetamaskRPCError(str) {
  const result = str.match(
    new RegExp(
      "VM Exception while processing transaction: revert " +
        "(.*)" +
        `\",\"code\"`
    )
  );

  return result[1];
}

export function converUnixTimestampToDate(unixTimestamp) {
  const date = new Date(unixTimestamp * 1000);
  return (
    date.getDate() +
    "/" +
    (date.getMonth() + 1) +
    "/" +
    date.getFullYear() +
    " " +
    date.getHours() +
    ":" +
    date.getMinutes() +
    ":" +
    date.getSeconds()
  );
}

export async function filter(arr, callback) {
  const fail = Symbol();
  return (
    await Promise.all(
      arr.map(async (item) => ((await callback(item)) ? item : fail))
    )
  ).filter((i) => i !== fail);
}