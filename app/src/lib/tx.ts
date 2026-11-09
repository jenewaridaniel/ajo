import { useState } from "react";
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, type Abi, type TransactionReceipt } from "viem";
import { useAccount, useConfig } from "wagmi";
import { readContract, simulateContract, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { useQueryClient } from "@tanstack/react-query";
import { erc20Abi } from "../abi";
import { AJO_ADDRESS, PRACTICE, chain } from "../config";

// What each contract error means, in plain words.
const reasons: Record<string, string> = {
  BadSize: "A circle needs between 2 and 20 members.",
  BadRoundLength: "A round must be between 1 minute and 30 days.",
  BadAmount: "Amounts must be more than zero.",
  BadName: "The name must be 1 to 48 characters.",
  NoSuchCircle: "That circle does not exist.",
  AlreadyStarted: "This circle has already started.",
  NotStarted: "This circle has not started yet. It starts when it is full.",
  Full: "This circle is full.",
  AlreadyMember: "You are already in this circle.",
  NotMember: "You are not a member of this circle.",
  MemberDefaulted: "You missed a round, so your bond went to the members who kept paying.",
  CircleOver: "All rounds of this circle are over.",
  AlreadyPaid: "You have already paid this round.",
  RoundStillOpen: "This round is still open: not everyone has paid and there is time left.",
  NotOver: "Bonds can be claimed only after the last round is closed.",
  AlreadyClaimed: "You have already claimed your bond.",
  NothingOwed: "There is nothing for you to withdraw.",
  NotInvited: "This circle is invite-only, and this wallet is not on the list. Ask the person who started it to add you.",
  NotCreator: "Only the person who started this circle can invite people.",
  NotInviteOnly: "This circle is open to anyone, so there is no invite list.",
  TooManyInvites: "That is too many wallets at once: add 50 at most.",
  ERC20InsufficientBalance: "Your wallet does not have enough of this token.",
  ERC20InsufficientAllowance: "The approval was too small. Try again.",
};

export function explain(err: unknown): string {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return "You cancelled it in your wallet.";
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name && reasons[name]) return reasons[name];
      if (revert.reason) return revert.reason;
    }
    if (/insufficient funds/i.test(err.message)) return "Not enough ETH in your wallet to pay the network fee.";
    return err.shortMessage || err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

export type Call = {
  abi: Abi;
  address: `0x${string}`;
  functionName: string;
  args?: readonly unknown[];
};

/** A token the contract must be allowed to take before the call. */
export type Needs = { token: `0x${string}`; amount: bigint; symbol: string };

/**
 * Runs one contract call, first asking the wallet to approve the token if the
 * contract is not yet allowed to take enough of it. Each step is checked with a
 * dry run first, so a call that would fail shows the reason instead of costing gas.
 */
export function useTx() {
  const config = useConfig();
  const { address, chainId } = useAccount();
  const qc = useQueryClient();
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<`0x${string}` | null>(null);

  async function send(call: Call, label: string) {
    const { request } = await simulateContract(config, { ...call, account: address, chainId: chain.id } as never);
    setStep(`${label}: confirm in your wallet`);
    const hash = await writeContract(config, request as never);
    setLastHash(hash);
    setStep(`${label}: waiting for the chain`);
    const receipt = await waitForTransactionReceipt(config, { hash, chainId: chain.id });
    if (receipt.status !== "success") throw new Error(`${label} failed on the chain.`);
    return receipt;
  }

  /** Returns the receipt of the main call, or null if anything failed (the reason is in `error`). */
  async function run(call: Call, label: string, needs?: Needs): Promise<TransactionReceipt | null> {
    setError(null);
    setLastHash(null);
    try {
      if (PRACTICE)
        throw new Error("Practice mode: this copy of the app reads from a test chain on this computer, so it never sends transactions. Nothing was sent.");
      if (!address) throw new Error("Connect your wallet first.");
      if (chainId !== chain.id) {
        setStep("Switching your wallet to Robinhood Chain");
        await switchChain(config, { chainId: chain.id });
      }
      if (needs && needs.amount > 0n) {
        const allowed = await readContract(config, {
          abi: erc20Abi,
          address: needs.token,
          functionName: "allowance",
          args: [address, AJO_ADDRESS as `0x${string}`],
          chainId: chain.id,
        });
        if (allowed < needs.amount) {
          // Approve exactly what this step needs, never an unlimited amount.
          await send(
            { abi: erc20Abi, address: needs.token, functionName: "approve", args: [AJO_ADDRESS, needs.amount] },
            `Step 1 of 2: allow Ajo to take ${needs.symbol}`,
          );
          label = `Step 2 of 2: ${label}`;
        }
      }
      const receipt = await send(call, label);
      setStep(null);
      await qc.invalidateQueries();
      return receipt;
    } catch (e) {
      setStep(null);
      setError(explain(e));
      await qc.invalidateQueries();
      return null;
    }
  }

  return { run, step, error, lastHash, busy: step !== null, clearError: () => setError(null) };
}
