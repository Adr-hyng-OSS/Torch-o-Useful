import { Block, system } from "@minecraft/server";
import {includeCustomTorch, excludeCustomTorch} from "../packages";

function isTorchIncluded(blockID: string): boolean {
  const currentPatterns: string[] = [
    '^[\\w\\-]+:(?:[\\w_]+_)?torch$'
  ];

  const excludeRegexes: RegExp[] = excludeCustomTorch.map((excluded: string) => new RegExp(excluded));
  
  const isExcluded: boolean = excludeRegexes.some((regex: RegExp) => regex.test(blockID));
  if (isExcluded) {
    return false;
  }

  let patterns: string[]  = [...currentPatterns, ...includeCustomTorch];
  const combinedPattern = new RegExp(patterns.join('|'));
  return combinedPattern.test(blockID);
}

function forceSetPermutation(_block: Block, flag: boolean, state: string = "lit"){
  const perm = _block.permutation.withState(state, !flag);
  system.run(() => _block.setPermutation(perm));
}

export {isTorchIncluded, forceSetPermutation};