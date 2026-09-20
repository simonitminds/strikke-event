// Prints fresh random values for .env. Run with:  deno task generate-tokens
const TOKEN_BYTES = 32;

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

console.log(`SIGNUP_TOKEN=${randomHex(TOKEN_BYTES)}`);
console.log(`ADMIN_TOKEN=${randomHex(TOKEN_BYTES)}`);
console.log(`SESSION_SECRET=${randomHex(TOKEN_BYTES)}`);
console.log("");
console.log("Copy the values above into your .env file and keep them secret.");
