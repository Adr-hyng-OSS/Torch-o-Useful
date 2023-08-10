import { includeCustomTorch, excludeCustomTorch } from "../packages";
function isTorchIncluded(blockID) {
    const currentPatterns = [
        '^[\\w\\-]+:(?:[\\w_]+_)?torch$'
    ];
    const excludeRegexes = excludeCustomTorch.map((excluded) => new RegExp(excluded));
    const isExcluded = excludeRegexes.some((regex) => regex.test(blockID));
    if (isExcluded) {
        return false;
    }
    let patterns = [...currentPatterns, ...includeCustomTorch];
    const combinedPattern = new RegExp(patterns.join('|'));
    return combinedPattern.test(blockID);
}
export { isTorchIncluded };
