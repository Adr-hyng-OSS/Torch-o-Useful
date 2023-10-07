const newEntry = 'yn:torch_cat:"Helo"';

const [namespace, ...rest] = newEntry.split(":");
const newKey = `${namespace}:${rest[0].trim()}`;
const newValue = rest[1] ? rest[1].trim() : '';

console.log(newKey, newValue); // Output: yn:torch_cat 120
