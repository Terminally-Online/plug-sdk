import { usePlugContext, usePlugQueryClient } from "@/src/provider";
import * as fns from "@/src/fetch";

export const usePlug = () => {
  const { client } = usePlugContext();
  const queryClient = usePlugQueryClient();

  const options = { client, queryClient };

  return {
    address: (address: string) => fns.address(options, address),
    positions: (address: string, opts?: Parameters<typeof fns.positions>[2]) =>
      fns.positions(options, address, opts),
    context: (address: string, opts?: Parameters<typeof fns.context>[2]) =>
      fns.context(options, address, opts),
    transactions: (
      address: string,
      opts?: Parameters<typeof fns.transactions>[2],
    ) => fns.transactions(options, address, opts),
    chain: (opts?: Parameters<typeof fns.chain>[1]) => fns.chain(options, opts),
  };
};
